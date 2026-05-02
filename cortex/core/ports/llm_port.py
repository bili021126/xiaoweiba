"""
LLM Port 端口抽象

DeepSeek API 统一访问端口，支持模型分层策略
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class LLMPort(ABC):
    """
    LLM 访问端口
    
    支持 DeepSeek V4 的所有能力：
    - Chat Completion
    - Function Calling
    - JSON Output
    - FIM Completion (Beta)
    - Prefix Completion (Beta)
    - Thinking Mode
    """
    
    @abstractmethod
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "deepseek-v4-flash",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        response_format: Optional[Dict[str, str]] = None,
        reasoning_effort: Optional[str] = None  # "low", "medium", "high", "max"
    ) -> Dict[str, Any]:
        """
        标准对话补全
        
        Args:
            messages: 消息列表
            model: 模型 ID
            temperature: 温度参数
            max_tokens: 最大 Token 数
            tools: 工具定义（Function Calling）
            response_format: 响应格式（{"type": "json_object"}）
            reasoning_effort: 思考强度（Thinking Mode）
            
        Returns:
            Dict: 包含 choices、usage 等的响应
        """
        pass
    
    @abstractmethod
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
        pass
    
    @abstractmethod
    async def prefix_completion(
        self,
        messages: List[Dict[str, str]],
        prefix: str,
        model: str = "deepseek-v4-pro",
        response_format: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        对话前缀续写（Beta 端点，强制 JSON 输出）
        
        Args:
            messages: 消息列表
            prefix: 助手回复前缀
            model: 模型 ID
            response_format: 响应格式
            
        Returns:
            Dict: 补全结果
        """
        pass
    
    @abstractmethod
    def get_model_config(self, model_id: str) -> Dict[str, Any]:
        """
        获取模型配置
        
        Args:
            model_id: 模型 ID
            
        Returns:
            Dict: 模型配置（API URL、默认参数等）
        """
        pass
