"""
测试 Mock 配置工具

集中定义常用的 Mock 对象，避免在每个测试文件中重复定义
遵循测试 Mock 配置集中化规范
"""
from unittest.mock import AsyncMock, MagicMock
from cortex.core.ports.memory_portal import MemoryPortal
from cortex.core.events.event_bus import EventBus
from cortex.core.ports.llm_port import LLMPort


def create_mock_memory_portal() -> MagicMock:
    """
    创建 Mock MemoryPortal
    
    Returns:
        MagicMock: 配置好的 MemoryPortal Mock 对象
    """
    portal = MagicMock(spec=MemoryPortal)
    portal.store_operation = AsyncMock(return_value="mem_test_123")
    portal.retrieve_relevant = AsyncMock(return_value=[])
    portal.list_sessions = AsyncMock(return_value=[])
    portal.get_session_history = AsyncMock(return_value=[])
    portal.update_memory_importance = AsyncMock()
    portal.delete_memory = AsyncMock()
    return portal


def create_mock_event_bus() -> MagicMock:
    """
    创建 Mock EventBus
    
    Returns:
        MagicMock: 配置好的 EventBus Mock 对象
    """
    bus = MagicMock(spec=EventBus)
    bus.publish = AsyncMock()
    bus.subscribe = MagicMock()
    bus.unsubscribe = MagicMock()
    bus.get_events_by_type = MagicMock(return_value=[])
    return bus


def create_mock_llm_port() -> MagicMock:
    """
    创建 Mock LLMPort
    
    Returns:
        MagicMock: 配置好的 LLMPort Mock 对象
    """
    llm = MagicMock(spec=LLMPort)
    llm.chat_completion = AsyncMock(return_value={
        "choices": [{"message": {"content": "Test response", "role": "assistant"}}],
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_tokens": 15
        },
        "model": "deepseek-v4-flash"
    })
    llm.fim_completion = AsyncMock(return_value={
        "choices": [{"text": "def hello():\n    pass"}]
    })
    llm.prefix_completion = AsyncMock(return_value={
        "choices": [{"message": {"content": '{"key": "value"}', "role": "assistant"}}]
    })
    llm.get_model_config = MagicMock(return_value={
        "api_url": "https://api.deepseek.com",
        "max_tokens": 8192
    })
    return llm


def create_mock_deepseek_client() -> MagicMock:
    """
    创建 Mock DeepSeekClient（用于基础设施层测试）
    
    Returns:
        MagicMock: 配置好的 DeepSeekClient Mock 对象
    """
    from cortex.core.deepseek_client import DeepSeekClient
    
    client = MagicMock(spec=DeepSeekClient)
    client.api_key = "test-key"
    
    # Mock chat_completion 返回 OpenAI 风格的响应对象
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="Test response"))]
    mock_response.usage = MagicMock(
        prompt_tokens=10,
        completion_tokens=5,
        total_tokens=15
    )
    mock_response.model = "deepseek-v4-flash"
    
    client.chat_completion = AsyncMock(return_value=mock_response)
    
    # Mock FIM completion
    mock_fim_response = MagicMock()
    mock_fim_response.choices = [MagicMock(text="def hello():\n    pass")]
    client.fim_completion = AsyncMock(return_value=mock_fim_response)
    
    # Mock prefix completion
    mock_prefix_response = MagicMock()
    mock_prefix_response.choices = [MagicMock(message=MagicMock(content='{"key": "value"}'))]
    client.prefix_completion = AsyncMock(return_value=mock_prefix_response)
    
    return client
