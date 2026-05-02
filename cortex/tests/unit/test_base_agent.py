"""
AutonomousAgent 基类单元测试

测试 Agent 的标准循环、错误处理和双向端口原则
遵循 TEST-001 ~ TEST-004：只 Mock 端口抽象，不 Mock 具体实现
"""
import pytest
from cortex.agents.base_agent import AutonomousAgent
from cortex.core.ports.sub_agent import AgentResult, AgentCapability
from tests.helpers import create_mock_memory_portal, create_mock_event_bus, create_mock_llm_port


class MockAgent(AutonomousAgent):
    """用于测试的 Mock Agent（遵循双向端口原则）"""
    
    @property
    def agent_id(self) -> str:
        return "mock_agent"  # snake_case
    
    @property
    def name(self) -> str:
        return "Mock Agent"
    
    @property
    def supported_intents(self):
        return ["test"]
    
    def __init__(self, memory_portal: MemoryPortal, event_bus: EventBus, llm_client):
        """通过构造函数注入依赖（双向端口原则）"""
        super().__init__(memory_portal, event_bus, llm_client)
    
    def get_capabilities(self):
        return [
            AgentCapability(name="test_cap", description="Test capability")
        ]
    
    async def think(self, intent: str, context: dict) -> dict:
        return {"plan": "test plan"}
    
    async def act(self, plan: dict, context: dict) -> dict:
        return {"action_result": "success"}
    
    async def observe(self, action_result: dict, start_time: float) -> AgentResult:
        return AgentResult(success=True, data=action_result)


class TestAgentResult:
    """AgentResult 数据类测试"""
    
    def test_success_result(self):
        """测试成功结果"""
        result = AgentResult(
            success=True,
            data={"key": "value"},
            token_usage={"total_tokens": 100},
            duration_ms=500,
            model_id="deepseek-v4-flash"
        )
        
        assert result.success is True
        assert result.data == {"key": "value"}
        assert result.token_usage["total_tokens"] == 100
        assert result.duration_ms == 500
        assert result.model_id == "deepseek-v4-flash"
    
    def test_error_result(self):
        """测试错误结果"""
        result = AgentResult(
            success=False,
            error="Something went wrong"
        )
        
        assert result.success is False
        assert result.error == "Something went wrong"
        assert result.data is None


class TestAutonomousAgent:
    """AutonomousAgent 基类测试"""
    
    @pytest.fixture
    def mock_memory_portal(self):
        """创建 Mock MemoryPortal（使用工厂函数）"""
        return create_mock_memory_portal()
    
    @pytest.fixture
    def mock_event_bus(self):
        """创建 Mock EventBus（使用工厂函数）"""
        return create_mock_event_bus()
    
    @pytest.fixture
    def mock_llm_client(self):
        """创建 Mock LLM Client（使用工厂函数）"""
        return create_mock_llm_port()
    
    @pytest.fixture
    def agent(self, mock_memory_portal, mock_event_bus, mock_llm_client):
        """创建 Mock Agent 实例（注入依赖）"""
        return MockAgent(mock_memory_portal, mock_event_bus, mock_llm_client)
    
    def test_agent_properties(self, agent):
        """测试 Agent 属性"""
        assert agent.agent_id == "mock_agent"  # snake_case
        assert agent.name == "Mock Agent"
        assert agent.supported_intents == ["test"]
    
    def test_dependency_injection(self, agent, mock_memory_portal, mock_event_bus, mock_llm_client):
        """测试依赖注入（双向端口原则）"""
        assert agent.memory_portal is mock_memory_portal
        assert agent.event_bus is mock_event_bus
        assert agent.llm_client is mock_llm_client
    
    def test_get_capabilities(self, agent):
        """测试获取能力列表"""
        capabilities = agent.get_capabilities()
        assert len(capabilities) == 1
        assert capabilities[0].name == "test_cap"
    
    @pytest.mark.asyncio
    async def test_execute_success(self, agent, mock_event_bus):
        """测试成功执行并发布事件"""
        result = await agent.execute("test", {"context": "data", "task_id": "task_123"})
        
        assert result.success is True
        assert result.data is not None
        
        # 验证发布了 TaskStartedEvent 和 TaskCompletedEvent
        assert mock_event_bus.publish.call_count >= 2
    
    @pytest.mark.asyncio
    async def test_execute_with_retry(self, agent, mock_event_bus):
        """测试重试机制"""
        call_count = 0
        
        original_think = agent.think
        
        async def failing_then_success(intent, context):
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise Exception("Temporary failure")
            return await original_think(intent, context)
        
        agent.think = failing_then_success
        
        result = await agent.execute("test", {"task_id": "task_456"})
        
        assert result.success is True
        assert call_count == 2  # 第一次失败，第二次成功
    
    @pytest.mark.asyncio
    async def test_execute_max_retries_exceeded(self, agent, mock_event_bus):
        """测试超过最大重试次数并发布 TaskFailedEvent"""
        async def always_fail(intent, context):
            raise Exception("Persistent failure")
        
        agent.think = always_fail
        
        result = await agent.execute("test", {"task_id": "task_789"})
        
        assert result.success is False
        assert "Persistent failure" in result.error
        
        # 验证发布了 TaskFailedEvent
        assert mock_event_bus.publish.call_count >= 2
    
    @pytest.mark.asyncio
    async def test_execute_records_duration(self, agent):
        """测试执行时长记录"""
        result = await agent.execute("test", {"task_id": "task_duration"})
        
        assert result.duration_ms is not None
        assert result.duration_ms >= 0
    
    @pytest.mark.asyncio
    async def test_think_method_signature(self, agent):
        """测试 think 方法签名"""
        plan = await agent.think("test_intent", {"key": "value"})
        assert isinstance(plan, dict)
    
    @pytest.mark.asyncio
    async def test_act_method_signature(self, agent):
        """测试 act 方法签名"""
        result = await agent.act({"plan": "test"})
        assert isinstance(result, dict)
    
    @pytest.mark.asyncio
    async def test_observe_method_signature(self, agent):
        """测试 observe 方法签名"""
        result = await agent.observe({"action": "test"})
        assert isinstance(result, AgentResult)
    
    def test_supported_intents_check(self, agent):
        """测试意图支持检查"""
        assert agent.supports_intent("test") is True
        assert agent.supports_intent("unsupported") is False
