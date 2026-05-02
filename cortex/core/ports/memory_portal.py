"""
MemoryPortal 端口抽象

统一记忆访问端口，遵循 MEM-001 ~ MEM-005
严禁直接操作具体存储对象（如 EpisodicMemory、ChromaDB）
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime


class MemoryPortal(ABC):
    """
    统一记忆访问端口
    
    职责：
    1. 存储操作记忆（非对话历史）
    2. 语义检索相关记忆
    3. 管理会话列表（由 SessionManager 独立管理）
    
    核心原则：
    - 操作记忆和会话历史严格分离
    - 所有记忆读写必须通过此端口
    - 禁止直接访问底层存储（ChromaDB、SQLite）
    """
    
    @abstractmethod
    async def store_operation(
        self,
        operation_type: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        存储操作记忆
        
        Args:
            operation_type: 操作类型（如 "code_explain", "commit_generate"）
            content: 操作内容
            metadata: 元数据（时间戳、重要性等）
            
        Returns:
            str: 记忆 ID
            
        Raises:
            Exception: 存储失败时抛出异常并发布 SystemErrorEvent
        """
        pass
    
    @abstractmethod
    async def retrieve_relevant(
        self,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        语义检索相关记忆
        
        Args:
            query: 查询文本
            top_k: 返回结果数量
            filters: 过滤条件（时间范围、操作类型等）
            
        Returns:
            List[Dict]: 相关记忆列表，按相关性排序
        """
        pass
    
    @abstractmethod
    async def list_sessions(
        self,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        列出会话（由 SessionManager 管理）
        
        注意：这不污染操作记忆库，仅返回会话元数据
        
        Args:
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            List[Dict]: 会话列表
        """
        pass
    
    @abstractmethod
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
        pass
    
    @abstractmethod
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
        pass
    
    @abstractmethod
    async def delete_memory(self, memory_id: str) -> None:
        """
        删除记忆
        
        Args:
            memory_id: 记忆 ID
        """
        pass
