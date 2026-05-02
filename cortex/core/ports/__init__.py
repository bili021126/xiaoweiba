"""
Core Ports - 核心端口抽象层

所有端口遵循依赖倒置原则（DIP），Application 层和 Infrastructure 层都依赖于此。
"""
from .sub_agent import SubAgent, AgentResult, AgentCapability
from .memory_portal import MemoryPortal
from .llm_port import LLMPort

__all__ = [
    "SubAgent",
    "AgentResult",
    "AgentCapability",
    "MemoryPortal",
    "LLMPort",
]
