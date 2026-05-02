"""
AutonomousAgent 基类单元测试

测试 Agent 的标准循环和错误处理
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from cortex.agents.base_agent import AutonomousAgent, AgentResult, AgentCapability


class MockAgent(AutonomousAgent):
    """用于测试的 Mock Agent"""
    
    @property
    def agent_id(self) -> str:
        return "mock-agent"
    
    @property
    def name(self) -> str:
        return "Mock Agent"
    
    @property
    def supported_intents(self):
        return ["test"]
    
    def get_capabilities(self):
        return [
            AgentCapability(name="test_cap", description="Test capability")
        ]
    
    async def think(self, intent: str, context: dict) -> dict:
        return {"plan": "test plan"}
    
    async def act(self, plan: dict) -> dict:
        return {"action_result": "success"}
    
    async def observe(self, action_result: dict) -> AgentResult:
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
    def agent(self):
        """创建 Mock Agent 实例"""
        return MockAgent()
    
    def test_agent_properties(self, agent):
        """测试 Agent 属性"""
        assert agent.agent_id == "mock-agent"
        assert agent.name == "Mock Agent"
        assert agent.supported_intents == ["test"]
    
    def test_get_capabilities(self, agent):
        """测试获取能力列表"""
        capabilities = agent.get_capabilities()
        assert len(capabilities) == 1
        assert capabilities[0].name == "test_cap"
    
    @pytest.mark.asyncio
    async def test_execute_success(self, agent):
        """测试成功执行"""
        result = await agent.execute("test", {"context": "data"})
        
        assert result.success is True
        assert result.data is not None
    
    @pytest.mark.asyncio
    async def test_execute_with_retry(self, agent):
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
        
        result = await agent.execute("test", {})
        
        assert result.success is True
        assert call_count == 2  # 第一次失败，第二次成功
    
    @pytest.mark.asyncio
    async def test_execute_max_retries_exceeded(self, agent):
        """测试超过最大重试次数"""
        async def always_fail(intent, context):
            raise Exception("Persistent failure")
        
        agent.think = always_fail
        
        result = await agent.execute("test", {})
        
        assert result.success is False
        assert "Persistent failure" in result.error
    
    @pytest.mark.asyncio
    async def test_execute_records_duration(self, agent):
        """测试执行时长记录"""
        result = await agent.execute("test", {})
        
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
