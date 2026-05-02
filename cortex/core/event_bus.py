"""
基于 asyncio 的事件总线

实现发布-订阅模式，支持跨模块异步通信
"""
import asyncio
from typing import Callable, Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class DomainEvent:
    """领域事件基类"""
    event_type: str
    payload: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())
    source: Optional[str] = None


class EventBus:
    """
    基于 asyncio 的事件总线
    
    遵循 Cortex 架构法典 COM-001 ~ COM-004：
    - 跨模块通信必须通过 EventBus
    - Agent 之间严禁直接通信
    - 所有记忆读写通过端口接口（内部可发布事件）
    """
    
    def __init__(self):
        """初始化事件总线"""
        self.subscribers: Dict[str, List[Callable]] = {}
        self.event_history: List[DomainEvent] = []
        self.max_history = 1000  # 保留最近 1000 个事件
    
    def subscribe(self, event_type: str, handler: Callable) -> None:
        """
        订阅事件
        
        Args:
            event_type: 事件类型
            handler: 事件处理函数（可以是同步或异步）
        """
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        
        self.subscribers[event_type].append(handler)
    
    def unsubscribe(self, event_type: str, handler: Callable) -> None:
        """
        取消订阅
        
        Args:
            event_type: 事件类型
            handler: 要取消的处理函数
        """
        if event_type in self.subscribers:
            self.subscribers[event_type].remove(handler)
    
    async def publish(self, event: DomainEvent) -> None:
        """
        发布事件
        
        Args:
            event: 领域事件对象
        """
        # 记录事件历史
        self.event_history.append(event)
        if len(self.event_history) > self.max_history:
            self.event_history.pop(0)
        
        # 获取该事件类型的所有订阅者
        handlers = self.subscribers.get(event.event_type, [])
        
        if not handlers:
            return
        
        # 并行执行所有处理器
        tasks = []
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    tasks.append(handler(event))
                else:
                    # 同步函数，在线程池中执行
                    tasks.append(asyncio.to_thread(handler, event))
            except Exception as e:
                # 记录错误但不中断其他处理器
                print(f"[EventBus] Error in handler for {event.event_type}: {e}")
        
        # 等待所有处理器完成（允许异常）
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def publish_simple(self, event_type: str, payload: Dict[str, Any] = None, source: str = None) -> None:
        """
        简化版事件发布（快速创建并发布事件）
        
        Args:
            event_type: 事件类型
            payload: 事件载荷
            source: 事件来源
        """
        event = DomainEvent(
            event_type=event_type,
            payload=payload or {},
            source=source
        )
        await self.publish(event)
    
    def get_event_history(self, event_type: Optional[str] = None, limit: int = 100) -> List[DomainEvent]:
        """
        获取事件历史
        
        Args:
            event_type: 过滤事件类型（可选）
            limit: 返回的最大数量
            
        Returns:
            事件列表（按时间倒序）
        """
        if event_type:
            filtered = [e for e in self.event_history if e.event_type == event_type]
        else:
            filtered = self.event_history
        
        return filtered[-limit:]
    
    def clear_subscribers(self, event_type: Optional[str] = None) -> None:
        """
        清除订阅者
        
        Args:
            event_type: 要清除的事件类型（如果为 None 则清除所有）
        """
        if event_type:
            self.subscribers.pop(event_type, None)
        else:
            self.subscribers.clear()


# 预定义事件类型常量
class EventTypes:
    """事件类型常量"""
    
    # Agent 相关
    AGENT_SELECTED = "agent.selected"
    AGENT_EXECUTION_STARTED = "agent.execution_started"
    AGENT_EXECUTION_COMPLETED = "agent.execution_completed"
    AGENT_EXECUTION_FAILED = "agent.execution_failed"
    
    # 任务相关
    TASK_STARTED = "task.started"
    TASK_PROGRESS = "task.progress"
    TASK_COMPLETED = "task.completed"
    TASK_FAILED = "task.failed"
    TASK_PAUSED = "task.paused"
    TASK_RESUMED = "task.resumed"
    
    # 概念相关
    CONCEPT_SUBMITTED = "concept.submitted"
    CONCEPT_CLARIFIED = "concept.clarified"
    BLUEPRINT_GENERATED = "blueprint.generated"
    BLUEPRINT_CONFIRMED = "blueprint.confirmed"
    
    # 记忆相关
    MEMORY_RETRIEVED = "memory.retrieved"
    MEMORY_STORED = "memory.stored"
    
    # 安全相关
    TOOL_EXECUTED = "tool.executed"
    SECURITY_VIOLATION = "security.violation"
    
    # 系统相关
    SYSTEM_HEALTH_CHECK = "system.health_check"
    SYSTEM_ERROR = "system.error"
