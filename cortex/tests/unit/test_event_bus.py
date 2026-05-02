"""
EventBus 单元测试

测试事件总线的发布-订阅功能
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from cortex.core.event_bus import EventBus, DomainEvent, EventTypes


class TestDomainEvent:
    """DomainEvent 数据类测试"""
    
    def test_create_event(self):
        """测试创建事件"""
        event = DomainEvent(
            event_type="test.event",
            payload={"key": "value"},
            source="test-source"
        )
        
        assert event.event_type == "test.event"
        assert event.payload == {"key": "value"}
        assert event.source == "test-source"
        assert event.timestamp is not None
    
    def test_event_default_values(self):
        """测试默认值"""
        event = DomainEvent(event_type="test")
        
        assert event.payload == {}
        assert event.source is None
        assert isinstance(event.timestamp, float)


class TestEventBus:
    """EventBus 测试类"""
    
    @pytest.fixture
    def event_bus(self):
        """创建事件总线实例"""
        return EventBus()
    
    @pytest.mark.asyncio
    async def test_subscribe_and_publish(self, event_bus):
        """测试订阅和发布"""
        received_events = []
        
        async def handler(event: DomainEvent):
            received_events.append(event)
        
        # 订阅事件
        event_bus.subscribe("test.event", handler)
        
        # 发布事件
        event = DomainEvent(event_type="test.event", payload={"data": "test"})
        await event_bus.publish(event)
        
        assert len(received_events) == 1
        assert received_events[0].payload["data"] == "test"
    
    @pytest.mark.asyncio
    async def test_multiple_subscribers(self, event_bus):
        """测试多个订阅者"""
        results = []
        
        async def handler1(event):
            results.append("handler1")
        
        async def handler2(event):
            results.append("handler2")
        
        event_bus.subscribe("multi.event", handler1)
        event_bus.subscribe("multi.event", handler2)
        
        event = DomainEvent(event_type="multi.event")
        await event_bus.publish(event)
        
        assert len(results) == 2
        assert "handler1" in results
        assert "handler2" in results
    
    @pytest.mark.asyncio
    async def test_unsubscribe(self, event_bus):
        """测试取消订阅"""
        call_count = 0
        
        async def handler(event):
            nonlocal call_count
            call_count += 1
        
        event_bus.subscribe("test.event", handler)
        
        # 第一次发布
        await event_bus.publish(DomainEvent(event_type="test.event"))
        assert call_count == 1
        
        # 取消订阅
        event_bus.unsubscribe("test.event", handler)
        
        # 第二次发布（不应触发）
        await event_bus.publish(DomainEvent(event_type="test.event"))
        assert call_count == 1  # 仍然是 1
    
    @pytest.mark.asyncio
    async def test_sync_handler(self, event_bus):
        """测试同步处理器"""
        result = []
        
        def sync_handler(event):
            result.append(event.event_type)
        
        event_bus.subscribe("sync.event", sync_handler)
        
        event = DomainEvent(event_type="sync.event")
        await event_bus.publish(event)
        
        assert len(result) == 1
        assert result[0] == "sync.event"
    
    @pytest.mark.asyncio
    async def test_event_history(self, event_bus):
        """测试事件历史"""
        event1 = DomainEvent(event_type="event1")
        event2 = DomainEvent(event_type="event2")
        
        await event_bus.publish(event1)
        await event_bus.publish(event2)
        
        assert len(event_bus.event_history) == 2
        assert event_bus.event_history[0].event_type == "event1"
        assert event_bus.event_history[1].event_type == "event2"
    
    @pytest.mark.asyncio
    async def test_get_events_by_type(self, event_bus):
        """测试按类型查询事件"""
        event1 = DomainEvent(event_type="type.a")
        event2 = DomainEvent(event_type="type.b")
        event3 = DomainEvent(event_type="type.a")
        
        await event_bus.publish(event1)
        await event_bus.publish(event2)
        await event_bus.publish(event3)
        
        type_a_events = event_bus.get_events_by_type("type.a")
        assert len(type_a_events) == 2
        
        type_b_events = event_bus.get_events_by_type("type.b")
        assert len(type_b_events) == 1
    
    @pytest.mark.asyncio
    async def test_handler_error_does_not_break_others(self, event_bus):
        """测试一个处理器错误不影响其他处理器"""
        results = []
        
        async def failing_handler(event):
            raise ValueError("Handler error")
        
        async def success_handler(event):
            results.append("success")
        
        event_bus.subscribe("error.event", failing_handler)
        event_bus.subscribe("error.event", success_handler)
        
        event = DomainEvent(event_type="error.event")
        await event_bus.publish(event)
        
        # 成功的处理器应该仍然执行
        assert len(results) == 1
        assert results[0] == "success"
    
    @pytest.mark.asyncio
    async def test_predefined_event_types(self, event_bus):
        """测试预定义的事件类型常量"""
        assert hasattr(EventTypes, 'AGENT_SELECTED')
        assert hasattr(EventTypes, 'TASK_COMPLETED')
        assert hasattr(EventTypes, 'CONCEPT_SUBMITTED')
        
        # 验证事件类型格式
        assert EventTypes.AGENT_SELECTED == "agent.selected"
        assert EventTypes.TASK_COMPLETED == "task.completed"
