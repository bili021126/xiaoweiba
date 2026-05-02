"""
ChromaDB Memory Adapter - ChromaDB 记忆适配器

实现 MemoryPortal 端口的向量检索部分
"""
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings

from core.ports.memory_portal import MemoryPortal


class ChromaDBMemoryAdapter(MemoryPortal):
    """
    ChromaDB 记忆适配器
    
    职责：
    1. 存储操作记忆的向量嵌入
    2. 提供语义检索（向量相似度搜索）
    
    注意：会话历史和元数据由 SQLiteMemoryAdapter 负责
    """
    
    def __init__(self, chroma_path: str = "./data/chroma"):
        """
        初始化 ChromaDB 适配器
        
        Args:
            chroma_path: ChromaDB 数据路径
        """
        self.client = chromadb.PersistentClient(path=chroma_path)
        self.collection = self.client.get_or_create_collection(
            name="operation_memories",
            metadata={"description": "Operation memories with vector embeddings"}
        )
    
    async def store_operation(
        self,
        operation_type: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        存储操作记忆（向量嵌入）
        
        注意：此方法需要 embedding 模型，目前返回占位符 ID
        TODO: 集成 Transformers.js 或 OpenAI Embeddings
        
        Args:
            operation_type: 操作类型
            content: 操作内容
            metadata: 元数据
            
        Returns:
            str: 记忆 ID
        """
        # TODO: 生成向量嵌入
        # 目前使用简单哈希作为占位符
        import hashlib
        memory_id = hashlib.md5(content.encode()).hexdigest()
        
        self.collection.add(
            ids=[memory_id],
            documents=[content],
            metadatas=[{
                "operation_type": operation_type,
                **(metadata or {})
            }]
        )
        
        return memory_id
    
    async def retrieve_relevant(
        self,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        语义检索相关记忆（向量相似度搜索）
        
        Args:
            query: 查询文本
            top_k: 返回结果数量
            filters: 过滤条件
            
        Returns:
            List[Dict]: 相关记忆列表，按相关性排序
        """
        # TODO: 生成查询向量
        # 目前使用简单文本匹配作为占位符
        
        results = self.collection.query(
            query_texts=[query],
            n_results=top_k,
            where=filters
        )
        
        memories = []
        for i, doc_id in enumerate(results['ids'][0]):
            memories.append({
                "id": doc_id,
                "content": results['documents'][0][i],
                "metadata": results['metadatas'][0][i],
                "distance": results['distances'][0][i] if 'distances' in results else 0.0
            })
        
        return memories
    
    async def list_sessions(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """
        ChromaDB 不管理会话，返回空列表
        
        此方法应由 SQLiteMemoryAdapter 实现
        """
        return []
    
    async def get_session_history(self, session_id: str) -> List[Dict[str, Any]]:
        """
        ChromaDB 不存储会话历史，返回空列表
        
        此方法应由 SQLiteMemoryAdapter 实现
        """
        return []
    
    async def update_memory_importance(self, memory_id: str, importance: float) -> None:
        """
        更新记忆重要性评分
        
        Args:
            memory_id: 记忆 ID
            importance: 重要性评分
        """
        # ChromaDB 不支持直接更新元数据字段
        # 需要先删除再添加
        existing = self.collection.get(ids=[memory_id])
        if existing['ids']:
            self.collection.update(
                ids=[memory_id],
                metadatas=[{**existing['metadatas'][0], "importance": importance}]
            )
    
    async def delete_memory(self, memory_id: str) -> None:
        """
        删除记忆
        
        Args:
            memory_id: 记忆 ID
        """
        self.collection.delete(ids=[memory_id])
