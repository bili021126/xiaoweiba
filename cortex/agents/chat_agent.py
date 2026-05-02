"""
Chat Agent - 闲聊助手

处理用户的日常对话、问答、建议等通用意图
使用 DeepSeek V4-Flash 模型以控制成本
"""
from typing import List, Dict, Any
from .base_agent import AutonomousAgent, AgentResult, AgentCapability
from core.deepseek_client import DeepSeekClient


class ChatAgent(AutonomousAgent):
    """
    闲聊助手 Agent
    
    支持的意图：
    - chat: 日常对话
    - question: 知识问答
    - suggestion: 建议咨询
    """
    
    @property
    def agent_id(self) -> str:
        return "chat-agent"
    
    @property
    def name(self) -> str:
        return "聊天助手"
    
    @property
    def supported_intents(self) -> List[str]:
        return ["chat", "question", "suggestion"]
    
    def __init__(self, deepseek: DeepSeekClient):
        """
        初始化 Chat Agent
        
        Args:
            deepseek: DeepSeek API 客户端
        """
        self.deepseek = deepseek
    
    def get_capabilities(self) -> List[AgentCapability]:
        return [
            AgentCapability(
                name="日常对话",
                description="处理用户的日常聊天和问候",
                priority=1
            ),
            AgentCapability(
                name="知识问答",
                description="回答用户的技术问题和知识查询",
                priority=2
            ),
            AgentCapability(
                name="建议咨询",
                description="提供技术建议和最佳实践",
                priority=3
            )
        ]
    
    def get_system_prompt(self) -> str:
        return """你是 Cortex 的聊天助手，一个友好、专业的 AI 学徒。

行为约束：
- 使用自然、亲切的语气，像真实的学徒一样交流
- 禁止使用"根据记录"、"根据历史记忆"等元话语
- 禁止执行任何系统命令或访问网络资源
- 禁止修改用户文件或进行越权操作
- 遇到不确定的情况，诚实告知用户
- 语气随熟悉度变化：生疏时用"您"，熟悉后用"你"

回答风格：
- 简洁明了，避免冗长
- 主动提供帮助和建议
- 适当使用表情符号增加亲和力
- 记住用户的偏好和习惯"""
    
    async def think(self, intent: Dict, context: Dict) -> Dict:
        """分析用户意图，确定回答策略"""
        user_input = intent.get("payload", {}).get("message", "")
        
        # 简单的意图分类
        if "?" in user_input or "什么" in user_input or "如何" in user_input:
            strategy = "answer_question"
        elif "建议" in user_input or "推荐" in user_input:
            strategy = "provide_suggestion"
        else:
            strategy = "casual_chat"
        
        return {
            "strategy": strategy,
            "user_input": user_input,
            "context": context
        }
    
    async def act(self, plan: Dict, context: Dict) -> Any:
        """调用 LLM 生成回复"""
        user_input = plan["user_input"]
        strategy = plan["strategy"]
        
        # 构建消息列表
        messages = [
            {"role": "system", "content": self.get_system_prompt()},
        ]
        
        # 添加会话历史（如果有）
        session_history = context.get("session_history", [])
        for msg in session_history[-5:]:  # 最近 5 条消息
            messages.append(msg)
        
        # 添加当前用户输入
        messages.append({"role": "user", "content": user_input})
        
        # 调用 DeepSeek API
        response = await self.deepseek.chat_completion(
            messages=messages,
            model="deepseek-v4-flash",  # 使用 Flash 控制成本
            temperature=0.7,
            max_tokens=1024
        )
        
        return {
            "reply": response.choices[0].message.content,
            "model_id": response.model,
            "token_usage": response.usage.model_dump()
        }
    
    async def observe(self, result: Any, start_time: float) -> AgentResult:
        """观察结果并封装"""
        import time
        duration_ms = int((time.time() - start_time) * 1000)
        
        return AgentResult(
            success=True,
            data={"reply": result["reply"]},
            token_usage=result["token_usage"],
            duration_ms=duration_ms,
            model_id=result["model_id"]
        )
    
    async def execute(self, intent: Dict, context: Dict) -> AgentResult:
        """执行 Agent 逻辑（带重试）"""
        return await self.execute_with_retry(intent, context, max_retries=3)
