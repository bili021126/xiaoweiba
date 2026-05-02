"""
DeepSeek V4 API 统一客户端

支持标准端点和 Beta 端点（FIM, Prefix Completion, Strict Function Calling）
"""
import os
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI


class DeepSeekClient:
    """DeepSeek V4 API 统一客户端"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        初始化 DeepSeek 客户端
        
        Args:
            api_key: DeepSeek API Key，如果为 None 则从环境变量读取
        """
        self.api_key = api_key or os.environ.get("DEEPSEEK_API_KEY")
        
        if not self.api_key:
            raise ValueError(
                "DEEPSEEK_API_KEY environment variable is required. "
                "Please set it or pass api_key parameter."
            )
        
        # 标准端点（Chat Completion, Function Calling, JSON Output）
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://api.deepseek.com"
        )
        
        # Beta 端点（FIM, Prefix Completion, Strict Function Calling）
        self.beta_client = AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://api.deepseek.com/beta"
        )
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "deepseek-v4-pro",
        temperature: float = 0.3,
        max_tokens: Optional[int] = None,
        tools: Optional[List[Dict]] = None,
        response_format: Optional[Dict] = None,
        thinking: Optional[Dict] = None,
        reasoning_effort: Optional[str] = None,
        stream: bool = False,
        **kwargs
    ) -> Any:
        """
        标准对话补全
        
        Args:
            messages: 消息列表
            model: 模型名称
            temperature: 温度参数
            max_tokens: 最大生成 token 数
            tools: 工具列表（Function Calling）
            response_format: 响应格式（JSON Output）
            thinking: 思考模式配置
            reasoning_effort: 推理努力程度 (high/max)
            stream: 是否流式输出
            
        Returns:
            OpenAI 响应对象
        """
        params = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream,
        }
        
        if max_tokens:
            params["max_tokens"] = max_tokens
        
        if tools:
            params["tools"] = tools
        
        if response_format:
            params["response_format"] = response_format
        
        if thinking:
            params["thinking"] = thinking
        
        if reasoning_effort:
            params["reasoning_effort"] = reasoning_effort
        
        params.update(kwargs)
        
        return await self.client.chat.completions.create(**params)
    
    async def fim_completion(
        self,
        prompt: str,
        suffix: str,
        model: str = "deepseek-v4-flash",
        max_tokens: int = 64,
        temperature: float = 0.1,
        stop: Optional[List[str]] = None,
        **kwargs
    ) -> Any:
        """
        FIM 代码补全（Beta 端点）
        
        Args:
            prompt: 前缀代码
            suffix: 后缀代码
            model: 模型名称（仅非思考模式）
            max_tokens: 最大生成 token 数
            temperature: 温度参数
            stop: 停止序列
            
        Returns:
            OpenAI 响应对象
        """
        params = {
            "model": model,
            "prompt": prompt,
            "suffix": suffix,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        
        if stop:
            params["stop"] = stop
        
        params.update(kwargs)
        
        return await self.beta_client.completions.create(**params)
    
    async def prefix_completion(
        self,
        messages: List[Dict[str, str]],
        prefix: str,
        model: str = "deepseek-v4-pro",
        stop: Optional[List[str]] = None,
        temperature: float = 0.1,
        **kwargs
    ) -> Any:
        """
        对话前缀续写（Beta 端点，强制 JSON 输出）
        
        Args:
            messages: 消息列表
            prefix: 前缀内容（如 '{"agent": "'）
            model: 模型名称
            stop: 停止序列
            temperature: 温度参数
            
        Returns:
            OpenAI 响应对象
        """
        # 添加前缀消息
        messages_with_prefix = messages + [
            {"role": "assistant", "content": prefix, "prefix": True}
        ]
        
        params = {
            "model": model,
            "messages": messages_with_prefix,
            "temperature": temperature,
        }
        
        if stop:
            params["stop"] = stop
        
        params.update(kwargs)
        
        return await self.beta_client.chat.completions.create(**params)
