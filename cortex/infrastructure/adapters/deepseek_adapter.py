"""
DeepSeek Adapter - DeepSeek API 适配器

实现 LLMPort 端口，封装 DeepSeekClient
"""
from typing import List, Dict, Any, Optional

from core.ports.llm_port import LLMPort
from core.deepseek_client import DeepSeekClient


class DeepSeekAdapter(LLMPort):
    """
    DeepSeek API 适配器
    
    将 DeepSeekClient 适配为 LLMPort 接口
    遵循依赖倒置原则（DIP）
    """
    
    def __init__(self, deepseek_client: DeepSeekClient):
        """
        初始化 DeepSeek 适配器
        
        Args:
            deepseek_client: DeepSeek API 客户端实例
        """
        self.client = deepseek_client
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "deepseek-v4-flash",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        response_format: Optional[Dict[str, str]] = None,
        reasoning_effort: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        标准对话补全
        
        Args:
            messages: 消息列表
            model: 模型 ID
            temperature: 温度参数
            max_tokens: 最大 Token 数
            tools: 工具定义（Function Calling）
            response_format: 响应格式
            reasoning_effort: 思考强度
            
        Returns:
            Dict: 包含 choices、usage 等的响应
        """
        # 调用 DeepSeekClient
        response = await self.client.chat_completion(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        # 转换为标准格式
        return {
            "choices": [
                {
                    "message": {
                        "content": response.choices[0].message.content,
                        "role": "assistant"
                    }
                }
            ],
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            },
            "model": response.model
        }
    
    async def fim_completion(
        self,
        prompt: str,
        suffix: str,
        model: str = "deepseek-v4-flash",
        max_tokens: int = 256
    ) -> Dict[str, Any]:
        """
        FIM 代码补全（Beta 端点）
        
        Args:
            prompt: 前缀代码
            suffix: 后缀代码
            model: 模型 ID
            max_tokens: 最大 Token 数
            
        Returns:
            Dict: 补全结果
        """
        response = await self.client.fim_completion(
            prompt=prompt,
            suffix=suffix,
            model=model,
            max_tokens=max_tokens
        )
        
        return {
            "choices": [
                {
                    "text": response.choices[0].text
                }
            ]
        }
    
    async def prefix_completion(
        self,
        messages: List[Dict[str, str]],
        prefix: str,
        model: str = "deepseek-v4-pro",
        response_format: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        对话前缀续写（Beta 端点）
        
        Args:
            messages: 消息列表
            prefix: 助手回复前缀
            model: 模型 ID
            response_format: 响应格式
            
        Returns:
            Dict: 补全结果
        """
        response = await self.client.prefix_completion(
            messages=messages,
            prefix=prefix,
            model=model
        )
        
        return {
            "choices": [
                {
                    "message": {
                        "content": response.choices[0].message.content,
                        "role": "assistant"
                    }
                }
            ]
        }
    
    def get_model_config(self, model_id: str) -> Dict[str, Any]:
        """
        获取模型配置
        
        Args:
            model_id: 模型 ID
            
        Returns:
            Dict: 模型配置
        """
        # 从配置文件或环境变量读取
        configs = {
            "deepseek-v4-flash": {
                "api_url": "https://api.deepseek.com",
                "max_tokens": 8192,
                "supports_thinking": False
            },
            "deepseek-v4-pro": {
                "api_url": "https://api.deepseek.com",
                "beta_api_url": "https://api.deepseek.com/beta",
                "max_tokens": 64000,
                "supports_thinking": True
            }
        }
        
        return configs.get(model_id, {})
