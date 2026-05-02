"""
SubAgent 端口抽象

所有子 Agent 必须实现此接口，遵循 AG-001 ~ AG-006
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class AgentResult:
    """Agent 执行结果"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    token_usage: Optional[Dict[str, int]] = None
    duration_ms: Optional[int] = None
    model_id: Optional[str] = None


@dataclass
class AgentCapability:
    """Agent 能力描述"""
    name: str
    description: str
    priority: int = 0


class SubAgent(ABC):
    """
    所有子 Agent 必须实现的抽象端口
    
    遵循双向端口原则：
    - 对外提供服务：实现此接口
    - 对内消费服务：通过构造函数注入依赖（MemoryPortal, EventBus, LLM Client）
    """
    
    @property
    @abstractmethod
    def agent_id(self) -> str:
        """Agent 唯一标识（snake_case）"""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Agent 显示名称"""
        pass
    
    @property
    @abstractmethod
    def supported_intents(self) -> List[str]:
        """支持的意图列表"""
        pass
    
    @abstractmethod
    def get_capabilities(self) -> List[AgentCapability]:
        """获取 Agent 能力列表"""
        pass
    
    @abstractmethod
    async def execute(self, intent: str, context: Dict[str, Any]) -> AgentResult:
        """
        执行 Agent 任务
        
        Args:
            intent: 用户意图
            context: 上下文信息
            
        Returns:
            AgentResult: 执行结果
        """
        pass
    
    def supports_intent(self, intent: str) -> bool:
        """检查是否支持指定意图"""
        return intent in self.supported_intents
