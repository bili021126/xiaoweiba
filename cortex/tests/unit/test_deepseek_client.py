"""
DeepSeekClient 单元测试

测试 DeepSeek API 客户端的各种功能
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from cortex.core.deepseek_client import DeepSeekClient


class TestDeepSeekClient:
    """DeepSeekClient 测试类"""
    
    @pytest.fixture
    def client(self):
        """创建测试客户端实例"""
        with patch.dict('os.environ', {'DEEPSEEK_API_KEY': 'test-key'}):
            return DeepSeekClient()
    
    def test_init_with_env_key(self):
        """测试从环境变量初始化"""
        with patch.dict('os.environ', {'DEEPSEEK_API_KEY': 'env-key'}):
            client = DeepSeekClient()
            assert client.api_key == 'env-key'
    
    def test_init_with_explicit_key(self):
        """测试显式传入 API Key"""
        client = DeepSeekClient(api_key='explicit-key')
        assert client.api_key == 'explicit-key'
    
    @pytest.mark.asyncio
    async def test_chat_completion_success(self, client):
        """测试标准对话补全成功"""
        # Mock 响应
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content="Hello!"))
        ]
        mock_response.usage = MagicMock(
            prompt_tokens=10,
            completion_tokens=5,
            total_tokens=15
        )
        
        with patch.object(client.client.chat.completions, 'create', 
                         new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_response
            
            result = await client.chat_completion(
                messages=[{"role": "user", "content": "Hi"}],
                model="deepseek-v4-flash"
            )
            
            assert result.choices[0].message.content == "Hello!"
            assert result.usage.total_tokens == 15
            mock_create.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_fim_completion(self, client):
        """测试 FIM 代码补全"""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(text="def hello():\n    pass")
        ]
        
        with patch.object(client.beta_client.completions, 'create',
                         new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_response
            
            result = await client.fim_completion(
                prompt="def ",
                suffix="\n    return True",
                model="deepseek-v4-flash"
            )
            
            assert result.choices[0].text == "def hello():\n    pass"
            mock_create.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_prefix_completion(self, client):
        """测试前缀续写"""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content='{"key": "value"}'))
        ]
        
        with patch.object(client.beta_client.chat.completions, 'create',
                         new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_response
            
            result = await client.prefix_completion(
                messages=[{"role": "user", "content": "Generate JSON"}],
                prefix='{',
                model="deepseek-v4-pro"
            )
            
            assert result.choices[0].message.content == '{"key": "value"}'
            # 验证消息列表包含 prefix
            call_args = mock_create.call_args
            messages = call_args[1]['messages']
            assert messages[-1]['prefix'] is True
    
    @pytest.mark.asyncio
    async def test_chat_completion_with_temperature(self, client):
        """测试带温度参数的对话"""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="Response"))]
        
        with patch.object(client.client.chat.completions, 'create',
                         new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_response
            
            await client.chat_completion(
                messages=[{"role": "user", "content": "Test"}],
                temperature=0.7,
                max_tokens=100
            )
            
            call_args = mock_create.call_args
            assert call_args[1]['temperature'] == 0.7
            assert call_args[1]['max_tokens'] == 100
    
    @pytest.mark.asyncio
    async def test_chat_completion_error_handling(self, client):
        """测试错误处理"""
        with patch.object(client.client.chat.completions, 'create',
                         new_callable=AsyncMock) as mock_create:
            mock_create.side_effect = Exception("API Error")
            
            with pytest.raises(Exception, match="API Error"):
                await client.chat_completion(
                    messages=[{"role": "user", "content": "Test"}]
                )
