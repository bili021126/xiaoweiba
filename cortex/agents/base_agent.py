"""
AutonomousAgent 基类

所有子 Agent 必须继承此类，实现 SubAgent 端口
遵循 Think→Act→Observe 标准循环和双向端口原则
遵循 Cortex 架构法典 AG-001 ~ AG-006
"""
import asyncio
import time
from typing import List, Dict, Any, Optional

from core.ports.sub_agent import SubAgent, AgentResult, AgentCapability
from core.ports.memory_portal import MemoryPortal
from core.events.event_bus import EventBus
from core.events.domain_events import TaskStartedEvent, TaskCompletedEvent, TaskFailedEvent


class AutonomousAgent(SubAgent):
    """
    所有子 Agent 的抽象基类，实现 SubAgent 端口
    
    遵循 Think→Act→Observe 标准循环：
    1. Think: 分析意图，制定计划
    2. Act: 执行计划（调用 LLM、工具等）
    3. Observe: 观察结果，记录性能
    
    双向端口原则：
    - 对外提供服务：实现 SubAgent 接口
    - 对内消费服务：通过构造函数注入依赖（MemoryPortal, EventBus, LLM Client）
    
    架构约束：
    - AG-001: 每个 Agent 必须声明 supported_intents
    - AG-002: 遵循 Think→Act→Observe 循环
    - AG-003: 使用 Function Calling 返回标准化 tool_calls
    - AG-004: 高风险操作通过 ToolGateway 验证
    - AG-005: 错误自修复，最多重试 3 次
    - AG-006: System Prompt 包含行为约束
    """
    
    def __init__(
        self,
        memory_portal: MemoryPortal,
        event_bus: EventBus,
        llm_client: Any
    ):
        """
        初始化 Agent（双向端口原则）
        
        Args:
            memory_portal: 记忆访问端口
            event_bus: 事件总线
            llm_client: LLM 客户端
        """
        self.memory_portal = memory_portal
        self.event_bus = event_bus
        self.llm_client = llm_client
    
    @property
    @abstractmethod
    def agent_id(self) -> str:
        """
        Agent ID (snake_case)
        
        示例：
        - "chat_agent"
        - "code_explainer"
        - "generate_commit"
        """
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Agent 显示名称（中文）"""
        pass
    
    @property
    @abstractmethod
    def supported_intents(self) -> List[str]:
        """支持的意图类型列表"""
        pass
    
    async def execute(self, intent: str, context: Dict[str, Any]) -> AgentResult:
        """
        执行 Agent 逻辑（带重试机制）
        
        Args:
            intent: 用户意图类型
            context: 上下文信息，包括记忆、会话历史等
            
        Returns:
            AgentResult 执行结果
        """
        # 发布任务开始事件
        await self.event_bus.publish(TaskStartedEvent(
            task_id=context.get("task_id", "unknown"),
            agent_id=self.agent_id
        ))
        
        try:
            result = await self.execute_with_retry(intent, context)
            
            # 发布任务完成事件
            await self.event_bus.publish(TaskCompletedEvent(
                task_id=context.get("task_id", "unknown"),
                agent_id=self.agent_id,
                success=result.success,
                result=result.data
            ))
            
            return result
            
        except Exception as e:
            # 发布任务失败事件
            await self.event_bus.publish(TaskFailedEvent(
                task_id=context.get("task_id", "unknown"),
                agent_id=self.agent_id,
                error=str(e)
            ))
            
            return AgentResult(
                success=False,
                error=str(e)
            )
    
    @abstractmethod
    def get_capabilities(self) -> List[AgentCapability]:
        """获取 Agent 能力描述列表"""
        pass
    
    @abstractmethod
    def get_system_prompt(self) -> str:
        """
        获取 System Prompt
        
        必须包含行为约束（AG-006）：
        - 禁止执行危险命令
        - 禁止越权操作
        - 使用自然语气，避免元话语
        """
        pass
    
    async def think(self, intent: Dict, context: Dict) -> Dict:
        """
        Think 阶段：分析意图，制定计划
        
        子类可覆盖此方法实现自定义的思考逻辑
        
        Args:
            intent: 意图对象
            context: 上下文信息
            
        Returns:
            思考结果（计划、策略等）
        """
        # 默认实现：简单的意图分析
        return {
            "intent_type": intent.get("type"),
            "payload": intent.get("payload", {}),
            "analysis": "default"
        }
    
    async def act(self, plan: Dict, context: Dict) -> Any:
        """
        Act 阶段：执行计划
        
        子类必须覆盖此方法实现具体的执行逻辑
        
        Args:
            plan: Think 阶段生成的计划
            context: 上下文信息
            
        Returns:
            执行结果
        """
        raise NotImplementedError("Subclasses must implement act()")
    
    async def observe(self, result: Any, start_time: float) -> AgentResult:
        """
        Observe 阶段：观察结果，记录性能
        
        子类可覆盖此方法实现自定义的观察逻辑
        
        Args:
            result: Act 阶段的执行结果
            start_time: 执行开始时间
            
        Returns:
            AgentResult 封装后的结果
        """
        duration_ms = int((time.time() - start_time) * 1000)
        
        if isinstance(result, AgentResult):
            result.duration_ms = duration_ms
            return result
        
        return AgentResult(
            success=True,
            data=result,
            duration_ms=duration_ms
        )
    
    async def handle_error(self, error: Exception, attempt: int, max_retries: int = 3) -> bool:
        """
        错误处理与自修复（AG-005）
        
        Args:
            error: 捕获的异常
            attempt: 当前重试次数
            max_retries: 最大重试次数
            
        Returns:
            是否应该继续重试
        """
        if attempt >= max_retries:
            print(f"[{self.agent_id}] Error after {max_retries} attempts: {error}")
            return False
        
        print(f"[{self.agent_id}] Attempt {attempt + 1}/{max_retries} failed: {error}")
        print(f"[{self.agent_id}] Retrying...")
        
        # 可以在这里添加指数退避等策略
        await asyncio.sleep(min(2 ** attempt, 10))  # 最多等待 10 秒
        
        return True
    
    async def execute_with_retry(
        self,
        intent: Dict,
        context: Dict,
        max_retries: int = 3
    ) -> AgentResult:
        """
        带重试的执行包装器（AG-005）
        
        Args:
            intent: 意图对象
            context: 上下文信息
            max_retries: 最大重试次数
            
        Returns:
            AgentResult 执行结果
        """
        last_error = None
        
        for attempt in range(max_retries):
            try:
                start_time = time.time()
                
                # Think
                plan = await self.think(intent, context)
                
                # Act
                result = await self.act(plan, context)
                
                # Observe
                return await self.observe(result, start_time)
                
            except Exception as e:
                last_error = e
                should_retry = await self.handle_error(e, attempt, max_retries)
                
                if not should_retry:
                    break
        
        # 所有重试都失败
        return AgentResult(
            success=False,
            error=f"Failed after {max_retries} attempts: {str(last_error)}",
            duration_ms=None
        )
    
    def is_available(self) -> bool:
        """
        检查 Agent 是否可用
        
        子类可覆盖此方法实现健康检查
        
        Returns:
            是否可用
        """
        return True
    
    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(id={self.agent_id}, intents={self.supported_intents})"
