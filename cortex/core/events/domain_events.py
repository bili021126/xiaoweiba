"""
领域事件定义

所有跨模块通信必须通过 EventBus 发布/订阅这些事件，严禁直接方法调用。
遵循 COM-001 ~ COM-004
"""
from dataclasses import dataclass, field
from typing import Dict, Any, Optional
from datetime import datetime


@dataclass
class DomainEvent:
    """领域事件基类"""
    event_type: str
    payload: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())
    source: Optional[str] = None


# ==================== Agent 相关事件 ====================

@dataclass
class AgentSelectedEvent(DomainEvent):
    """Agent 被选中事件"""
    agent_id: str = ""
    intent: str = ""
    
    def __post_init__(self):
        self.event_type = "agent.selected"
        self.payload = {
            "agent_id": self.agent_id,
            "intent": self.intent
        }


@dataclass
class TaskStartedEvent(DomainEvent):
    """任务开始事件"""
    task_id: str = ""
    agent_id: str = ""
    
    def __post_init__(self):
        self.event_type = "task.started"
        self.payload = {
            "task_id": self.task_id,
            "agent_id": self.agent_id,
            "started_at": self.timestamp
        }


@dataclass
class TaskCompletedEvent(DomainEvent):
    """任务完成事件"""
    task_id: str = ""
    agent_id: str = ""
    success: bool = True
    result: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        self.event_type = "task.completed"
        self.payload = {
            "task_id": self.task_id,
            "agent_id": self.agent_id,
            "success": self.success,
            "result": self.result,
            "completed_at": self.timestamp
        }


@dataclass
class TaskFailedEvent(DomainEvent):
    """任务失败事件"""
    task_id: str = ""
    agent_id: str = ""
    error: str = ""
    
    def __post_init__(self):
        self.event_type = "task.failed"
        self.payload = {
            "task_id": self.task_id,
            "agent_id": self.agent_id,
            "error": self.error,
            "failed_at": self.timestamp
        }


# ==================== 记忆相关事件 ====================

@dataclass
class MemoryStoredEvent(DomainEvent):
    """记忆存储事件"""
    memory_id: str = ""
    operation_type: str = ""
    
    def __post_init__(self):
        self.event_type = "memory.stored"
        self.payload = {
            "memory_id": self.memory_id,
            "operation_type": self.operation_type
        }


@dataclass
class MemoryRetrievedEvent(DomainEvent):
    """记忆检索事件"""
    query: str = ""
    result_count: int = 0
    
    def __post_init__(self):
        self.event_type = "memory.retrieved"
        self.payload = {
            "query": self.query,
            "result_count": self.result_count
        }


# ==================== 概念相关事件 ====================

@dataclass
class ConceptSubmittedEvent(DomainEvent):
    """概念提交事件"""
    concept_id: str = ""
    user_input: str = ""
    
    def __post_init__(self):
        self.event_type = "concept.submitted"
        self.payload = {
            "concept_id": self.concept_id,
            "user_input": self.user_input
        }


@dataclass
class ConceptClarifiedEvent(DomainEvent):
    """概念澄清事件"""
    concept_id: str = ""
    answers: Dict[str, str] = field(default_factory=dict)
    
    def __post_init__(self):
        self.event_type = "concept.clarified"
        self.payload = {
            "concept_id": self.concept_id,
            "answers": self.answers
        }


# ==================== 蓝图相关事件 ====================

@dataclass
class BlueprintGeneratedEvent(DomainEvent):
    """蓝图生成事件"""
    blueprint_id: str = ""
    project_name: str = ""
    
    def __post_init__(self):
        self.event_type = "blueprint.generated"
        self.payload = {
            "blueprint_id": self.blueprint_id,
            "project_name": self.project_name
        }


@dataclass
class BlueprintConfirmedEvent(DomainEvent):
    """蓝图确认事件"""
    blueprint_id: str = ""
    action: str = ""  # "confirm", "modify", "reject"
    
    def __post_init__(self):
        self.event_type = "blueprint.confirmed"
        self.payload = {
            "blueprint_id": self.blueprint_id,
            "action": self.action
        }


# ==================== 系统事件 ====================

@dataclass
class SystemErrorEvent(DomainEvent):
    """系统错误事件
    
    当关键操作（如记忆存储）失败时发布此事件，通知用户。
    遵循记忆记录失败告警规范。
    """
    error_code: str = ""
    error_message: str = ""
    severity: str = "error"  # "warning", "error", "critical"
    
    def __post_init__(self):
        self.event_type = "system.error"
        self.payload = {
            "error_code": self.error_code,
            "error_message": self.error_message,
            "severity": self.severity,
            "occurred_at": self.timestamp
        }


@dataclass
class SystemHealthCheckEvent(DomainEvent):
    """系统健康检查事件"""
    status: str = "healthy"  # "healthy", "degraded", "unhealthy"
    
    def __post_init__(self):
        self.event_type = "system.health_check"
        self.payload = {
            "status": self.status,
            "checked_at": self.timestamp
        }


# ==================== 事件类型常量 ====================

class EventTypes:
    """事件类型常量（用于订阅）"""
    
    # Agent 事件
    AGENT_SELECTED = "agent.selected"
    TASK_STARTED = "task.started"
    TASK_COMPLETED = "task.completed"
    TASK_FAILED = "task.failed"
    
    # 记忆事件
    MEMORY_STORED = "memory.stored"
    MEMORY_RETRIEVED = "memory.retrieved"
    
    # 概念事件
    CONCEPT_SUBMITTED = "concept.submitted"
    CONCEPT_CLARIFIED = "concept.clarified"
    
    # 蓝图事件
    BLUEPRINT_GENERATED = "blueprint.generated"
    BLUEPRINT_CONFIRMED = "blueprint.confirmed"
    
    # 系统事件
    SYSTEM_ERROR = "system.error"
    SYSTEM_HEALTH_CHECK = "system.health_check"
