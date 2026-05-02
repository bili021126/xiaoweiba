"""
SQLite Memory Adapter - SQLite 记忆适配器

实现 MemoryPortal 端口，使用 SQLite 存储会话历史和操作元数据
"""
import sqlite3
import json
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

from core.ports.memory_portal import MemoryPortal
from core.events.event_bus import EventBus
from core.events.domain_events import SystemErrorEvent


class SQLiteMemoryAdapter(MemoryPortal):
    """
    SQLite 记忆适配器
    
    职责：
    1. 存储会话历史（对话记录）
    2. 存储操作记忆元数据（指向 ChromaDB 的记忆 ID）
    3. 提供会话列表查询
    
    注意：向量检索由 ChromaDBMemoryAdapter 负责
    """
    
    def __init__(self, db_path: str, event_bus: EventBus):
        """
        初始化 SQLite 适配器
        
        Args:
            db_path: SQLite 数据库路径
            event_bus: 事件总线（用于发布错误事件）
        """
        self.db_path = db_path
        self.event_bus = event_bus
        self._init_db()
    
    def _init_db(self):
        """初始化数据库 schema"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # 会话表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                title TEXT,
                metadata TEXT
            )
        """)
        
        # 消息表（会话历史）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                role TEXT NOT NULL,  -- 'user' | 'assistant' | 'system'
                content TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )
        """)
        
        # 操作记忆元数据表（指向 ChromaDB）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS operation_memories (
                id TEXT PRIMARY KEY,
                chroma_id TEXT NOT NULL,  -- ChromaDB 中的文档 ID
                operation_type TEXT NOT NULL,
                summary TEXT,
                importance REAL DEFAULT 0.5,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT
            )
        """)
        
        # 创建索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_operation_type ON operation_memories(operation_type)")
        
        conn.commit()
        conn.close()
    
    async def store_operation(
        self,
        operation_type: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        存储操作记忆元数据
        
        注意：实际向量嵌入由 ChromaDBMemoryAdapter 负责
        这里只存储元数据和指向 ChromaDB 的引用
        
        Args:
            operation_type: 操作类型
            content: 操作内容
            metadata: 元数据
            
        Returns:
            str: 记忆 ID
            
        Raises:
            Exception: 存储失败时抛出异常并发布 SystemErrorEvent
        """
        try:
            memory_id = str(uuid.uuid4())
            chroma_id = f"chroma_{memory_id}"  # 占位符，实际由 ChromaDB 生成
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                """
                INSERT INTO operation_memories (id, chroma_id, operation_type, summary, metadata)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    memory_id,
                    chroma_id,
                    operation_type,
                    content[:200],  # 摘要
                    json.dumps(metadata or {})
                )
            )
            
            conn.commit()
            conn.close()
            
            return memory_id
            
        except Exception as e:
            # 发布系统错误事件（遵循记忆记录失败告警规范）
            await self.event_bus.publish(SystemErrorEvent(
                error_code="MEMORY_STORE_FAILED",
                error_message=f"Failed to store operation memory: {str(e)}",
                severity="error"
            ))
            raise
    
    async def retrieve_relevant(
        self,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        语义检索相关记忆
        
        注意：实际向量检索由 ChromaDBMemoryAdapter 负责
        这里返回空列表，由组合适配器调用 ChromaDB
        
        Args:
            query: 查询文本
            top_k: 返回结果数量
            filters: 过滤条件
            
        Returns:
            List[Dict]: 相关记忆列表
        """
        # TODO: 此方法应由 ChromaDBMemoryAdapter 实现
        # SQLite 适配器仅提供基于元数据的过滤
        return []
    
    async def list_sessions(
        self,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        列出会话
        
        Args:
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            List[Dict]: 会话列表
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(
            """
            SELECT id, created_at, updated_at, title, metadata
            FROM sessions
            ORDER BY updated_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset)
        )
        
        rows = cursor.fetchall()
        sessions = []
        
        for row in rows:
            sessions.append({
                "id": row["id"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "title": row["title"],
                "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
            })
        
        conn.close()
        return sessions
    
    async def get_session_history(
        self,
        session_id: str
    ) -> List[Dict[str, Any]]:
        """
        获取会话历史（对话记录）
        
        Args:
            session_id: 会话 ID
            
        Returns:
            List[Dict]: 对话消息列表
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(
            """
            SELECT id, role, content, timestamp, metadata
            FROM messages
            WHERE session_id = ?
            ORDER BY timestamp ASC
            """,
            (session_id,)
        )
        
        rows = cursor.fetchall()
        messages = []
        
        for row in rows:
            messages.append({
                "id": row["id"],
                "role": row["role"],
                "content": row["content"],
                "timestamp": row["timestamp"],
                "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
            })
        
        conn.close()
        return messages
    
    async def update_memory_importance(
        self,
        memory_id: str,
        importance: float
    ) -> None:
        """
        更新记忆重要性评分
        
        Args:
            memory_id: 记忆 ID
            importance: 重要性评分（0.0 - 1.0）
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "UPDATE operation_memories SET importance = ? WHERE id = ?",
            (importance, memory_id)
        )
        
        conn.commit()
        conn.close()
    
    async def delete_memory(self, memory_id: str) -> None:
        """
        删除记忆
        
        Args:
            memory_id: 记忆 ID
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM operation_memories WHERE id = ?", (memory_id,))
        
        conn.commit()
        conn.close()
    
    # ==================== 辅助方法 ====================
    
    async def create_session(self, session_id: str, title: str = None) -> str:
        """
        创建新会话
        
        Args:
            session_id: 会话 ID
            title: 会话标题
            
        Returns:
            str: 会话 ID
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO sessions (id, title) VALUES (?, ?)",
            (session_id, title or "New Session")
        )
        
        conn.commit()
        conn.close()
        
        return session_id
    
    async def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        添加消息到会话
        
        Args:
            session_id: 会话 ID
            role: 角色（user/assistant/system）
            content: 消息内容
            metadata: 元数据
            
        Returns:
            str: 消息 ID
        """
        message_id = str(uuid.uuid4())
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            """
            INSERT INTO messages (id, session_id, role, content, metadata)
            VALUES (?, ?, ?, ?, ?)
            """,
            (message_id, session_id, role, content, json.dumps(metadata or {}))
        )
        
        # 更新会话的 updated_at
        cursor.execute(
            "UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (session_id,)
        )
        
        conn.commit()
        conn.close()
        
        return message_id
