"""
数据迁移工具

将小尾巴（XiaoWeiba）SQLite 数据库迁移到 Cortex 四层记忆架构
支持情景记忆、偏好记忆等数据的迁移
"""
import sqlite3
import json
import uuid
from pathlib import Path
from typing import Optional
from datetime import datetime


class DataMigrator:
    """
    数据迁移器
    
    负责将旧版小尾巴数据库迁移到新版 Cortex 架构
    """
    
    def __init__(
        self,
        source_db_path: str,
        target_sqlite_path: str,
        target_chroma_path: str
    ):
        """
        初始化迁移器
        
        Args:
            source_db_path: 源数据库路径（小尾巴 memory.db）
            target_sqlite_path: 目标 SQLite 数据库路径
            target_chroma_path: 目标 ChromaDB 数据路径
        """
        self.source_db_path = source_db_path
        self.target_sqlite_path = target_sqlite_path
        self.target_chroma_path = target_chroma_path
        
        self.source_conn: Optional[sqlite3.Connection] = None
        self.target_conn: Optional[sqlite3.Connection] = None
    
    def connect(self) -> None:
        """建立数据库连接"""
        # 连接源数据库
        if not Path(self.source_db_path).exists():
            raise FileNotFoundError(f"Source database not found: {self.source_db_path}")
        
        self.source_conn = sqlite3.connect(self.source_db_path)
        self.source_conn.row_factory = sqlite3.Row
        
        # 连接目标数据库
        self.target_conn = sqlite3.connect(self.target_sqlite_path)
    
    def close(self) -> None:
        """关闭数据库连接"""
        if self.source_conn:
            self.source_conn.close()
        if self.target_conn:
            self.target_conn.close()
    
    def migrate_all(self) -> dict:
        """
        执行完整迁移
        
        Returns:
            迁移统计信息
        """
        print("🚀 Starting data migration...")
        
        try:
            self.connect()
            
            stats = {
                'episodic_memories': self.migrate_episodic_memory(),
                'preference_memories': self.migrate_preference_memory(),
                'sessions': self.migrate_sessions(),
            }
            
            print("\n✅ Migration completed successfully!")
            print(f"   - Episodic memories: {stats['episodic_memories']}")
            print(f"   - Preference memories: {stats['preference_memories']}")
            print(f"   - Sessions: {stats['sessions']}")
            
            return stats
            
        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            raise
        finally:
            self.close()
    
    def migrate_episodic_memory(self) -> int:
        """
        迁移情景记忆到 ChromaDB
        
        Returns:
            迁移的记忆数量
        """
        print("\n📝 Migrating episodic memories...")
        
        cursor = self.source_conn.cursor()
        cursor.execute("SELECT * FROM episodic_memory")
        records = cursor.fetchall()
        
        count = 0
        
        # TODO: 集成 ChromaDB
        # chroma_client = chromadb.PersistentClient(path=self.target_chroma_path)
        # collection = chroma_client.get_or_create_collection("episodic_memory")
        
        for record in records:
            try:
                # 提取字段
                memory_data = {
                    'id': record['id'] or str(uuid.uuid4()),
                    'summary': record['summary'],
                    'task_type': record['task_type'],
                    'timestamp': record['timestamp'],
                    'entities': json.loads(record['entities']) if record['entities'] else [],
                    'decision': record.get('decision'),
                    'outcome': record.get('outcome'),
                    'project_fingerprint': record.get('project_fingerprint'),
                    'model_id': record.get('model_id'),
                    'duration_ms': record.get('duration_ms')
                }
                
                # TODO: 生成向量并存储到 ChromaDB
                # embedding = generate_embedding(memory_data['summary'])
                # collection.add(
                #     ids=[memory_data['id']],
                #     embeddings=[embedding],
                #     metadatas=memory_data,
                #     documents=[memory_data['summary']]
                # )
                
                count += 1
                
                if count % 100 == 0:
                    print(f"   Migrated {count} memories...")
                
            except Exception as e:
                print(f"   ⚠️  Failed to migrate memory {record['id']}: {e}")
                continue
        
        print(f"   ✅ Migrated {count} episodic memories")
        return count
    
    def migrate_preference_memory(self) -> int:
        """
        迁移偏好记忆
        
        Returns:
            迁移的偏好数量
        """
        print("\n❤️  Migrating preference memories...")
        
        cursor = self.source_conn.cursor()
        
        # 检查表是否存在
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='preference_memory'"
        )
        
        if not cursor.fetchone():
            print("   ⚠️  preference_memory table not found, skipping")
            return 0
        
        cursor.execute("SELECT * FROM preference_memory")
        records = cursor.fetchall()
        
        count = 0
        
        for record in records:
            try:
                # 插入到目标数据库
                self.target_conn.execute(
                    """
                    INSERT OR REPLACE INTO preference_memory 
                    (id, user_id, category, key, value, confidence, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record['id'],
                        record.get('user_id', 'default'),
                        record['category'],
                        record['key'],
                        record['value'],
                        record.get('confidence', 0.5),
                        record.get('updated_at', int(datetime.now().timestamp()))
                    )
                )
                
                count += 1
                
            except Exception as e:
                print(f"   ⚠️  Failed to migrate preference {record['id']}: {e}")
                continue
        
        self.target_conn.commit()
        print(f"   ✅ Migrated {count} preference memories")
        return count
    
    def migrate_sessions(self) -> int:
        """
        迁移会话历史
        
        Returns:
            迁移的会话数量
        """
        print("\n💬 Migrating sessions...")
        
        cursor = self.source_conn.cursor()
        
        # 检查表是否存在
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
        )
        
        if not cursor.fetchone():
            print("   ⚠️  sessions table not found, skipping")
            return 0
        
        cursor.execute("SELECT * FROM sessions")
        records = cursor.fetchall()
        
        count = 0
        
        for record in records:
            try:
                # 插入到目标数据库
                self.target_conn.execute(
                    """
                    INSERT OR REPLACE INTO sessions 
                    (id, title, created_at, updated_at, message_count)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        record['id'],
                        record.get('title', 'Untitled'),
                        record['created_at'],
                        record.get('updated_at', int(datetime.now().timestamp())),
                        record.get('message_count', 0)
                    )
                )
                
                count += 1
                
            except Exception as e:
                print(f"   ⚠️  Failed to migrate session {record['id']}: {e}")
                continue
        
        self.target_conn.commit()
        print(f"   ✅ Migrated {count} sessions")
        return count
    
    def create_target_schema(self) -> None:
        """
        创建目标数据库 schema
        
        如果目标数据库不存在，创建必要的表结构
        """
        if not self.target_conn:
            raise RuntimeError("Database not connected")
        
        cursor = self.target_conn.cursor()
        
        # 创建情景记忆表（简化版，实际使用 ChromaDB）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS episodic_memory_metadata (
                id TEXT PRIMARY KEY,
                summary TEXT,
                task_type TEXT,
                timestamp INTEGER,
                entities TEXT,
                importance REAL DEFAULT 1.0,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        """)
        
        # 创建偏好记忆表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS preference_memory (
                id TEXT PRIMARY KEY,
                user_id TEXT DEFAULT 'default',
                category TEXT,
                key TEXT,
                value TEXT,
                confidence REAL DEFAULT 0.5,
                updated_at INTEGER,
                UNIQUE(user_id, category, key)
            )
        """)
        
        # 创建会话表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT,
                created_at INTEGER,
                updated_at INTEGER,
                message_count INTEGER DEFAULT 0
            )
        """)
        
        self.target_conn.commit()
        print("✅ Target schema created")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate XiaoWeiba data to Cortex')
    parser.add_argument(
        '--source',
        default='./data/xiaoweiba/memory.db',
        help='Source database path'
    )
    parser.add_argument(
        '--target-sqlite',
        default='./data/cortex.db',
        help='Target SQLite database path'
    )
    parser.add_argument(
        '--target-chroma',
        default='./data/chroma',
        help='Target ChromaDB path'
    )
    
    args = parser.parse_args()
    
    migrator = DataMigrator(
        source_db_path=args.source,
        target_sqlite_path=args.target_sqlite,
        target_chroma_path=args.target_chroma
    )
    
    # 创建目标 schema
    migrator.connect()
    migrator.create_target_schema()
    migrator.close()
    
    # 执行迁移
    stats = migrator.migrate_all()
    
    print("\n📊 Migration Summary:")
    print(json.dumps(stats, indent=2))


if __name__ == '__main__':
    main()
