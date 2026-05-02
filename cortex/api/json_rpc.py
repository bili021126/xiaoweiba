"""
JSON-RPC 2.0 协议处理器

实现标准的 JSON-RPC 2.0 协议，用于 WebSocket 通信
遵循 Cortex 架构法典 COM-004
"""
from pydantic import BaseModel
from typing import Any, Optional, Dict, Callable
import asyncio


class JSONRPCRequest(BaseModel):
    """JSON-RPC 2.0 请求"""
    jsonrpc: str = "2.0"
    id: int
    method: str
    params: dict = {}


class JSONRPCResponse(BaseModel):
    """JSON-RPC 2.0 响应"""
    jsonrpc: str = "2.0"
    id: int
    result: Optional[Any] = None
    error: Optional[dict] = None


class JSONRPCHandler:
    """
    JSON-RPC 2.0 协议处理器
    
    支持的方法：
    - concept.submit: 提交概念
    - blueprint.confirm: 确认蓝图
    - task.pause: 暂停任务
    - task.resume: 恢复任务
    - task.cancel: 取消任务
    - chat.message: 发送聊天消息
    - skill.execute: 执行技能
    """
    
    def __init__(self, event_bus: Any, agent_runner: Any):
        """
        初始化 JSON-RPC 处理器
        
        Args:
            event_bus: 事件总线实例
            agent_runner: Agent 运行器实例
        """
        self.event_bus = event_bus
        self.agent_runner = agent_runner
        
        # 注册方法处理器
        self.methods: Dict[str, Callable] = {
            "concept.submit": self.handle_concept_submit,
            "blueprint.confirm": self.handle_blueprint_confirm,
            "task.pause": self.handle_task_pause,
            "task.resume": self.handle_task_resume,
            "task.cancel": self.handle_task_cancel,
            "chat.message": self.handle_chat_message,
            "skill.execute": self.handle_skill_execute,
        }
    
    async def handle_request(self, request: JSONRPCRequest) -> JSONRPCResponse:
        """
        处理 JSON-RPC 请求
        
        Args:
            request: JSON-RPC 请求对象
            
        Returns:
            JSON-RPC 响应对象
        """
        # 验证 jsonrpc 版本
        if request.jsonrpc != "2.0":
            return JSONRPCResponse(
                id=request.id,
                error={
                    "code": -32600,
                    "message": "Invalid Request: jsonrpc version must be 2.0"
                }
            )
        
        # 查找方法处理器
        handler = self.methods.get(request.method)
        
        if not handler:
            return JSONRPCResponse(
                id=request.id,
                error={
                    "code": -32601,
                    "message": f"Method not found: {request.method}"
                }
            )
        
        try:
            # 调用处理方法
            result = await handler(request.params)
            
            return JSONRPCResponse(
                id=request.id,
                result=result
            )
            
        except Exception as e:
            # 捕获异常并返回错误
            return JSONRPCResponse(
                id=request.id,
                error={
                    "code": -32000,
                    "message": str(e),
                    "data": {
                        "method": request.method,
                        "params": request.params
                    }
                }
            )
    
    # ==================== 方法处理器 ====================
    
    async def handle_concept_submit(self, params: dict) -> dict:
        """
        处理概念提交
        
        Args:
            params: {
                "user_input": "我想做一个xxx",
                "session_id": "uuid"
            }
            
        Returns:
            {
                "concept_id": "uuid",
                "clarification_questions": [...],
                "missing_info": [...]
            }
        """
        user_input = params.get("user_input")
        session_id = params.get("session_id")
        
        if not user_input:
            raise ValueError("user_input is required")
        
        # TODO: 调用 ConceptParser 解析概念
        # TODO: 发布 CONCEPT_SUBMITTED 事件
        
        return {
            "concept_id": "temp-concept-id",
            "clarification_questions": [
                "你需要用户注册登录功能吗？",
                "你偏好的技术栈是什么？"
            ],
            "missing_info": ["tech_stack", "deployment_target"]
        }
    
    async def handle_blueprint_confirm(self, params: dict) -> dict:
        """
        处理蓝图确认
        
        Args:
            params: {
                "blueprint_id": "uuid",
                "action": "confirm" | "modify" | "reject"
            }
            
        Returns:
            {
                "status": "confirmed",
                "task_id": "uuid"
            }
        """
        blueprint_id = params.get("blueprint_id")
        action = params.get("action")
        
        if not blueprint_id or not action:
            raise ValueError("blueprint_id and action are required")
        
        # TODO: 更新蓝图状态
        # TODO: 如果确认，启动任务执行
        
        return {
            "status": action,
            "task_id": "temp-task-id" if action == "confirm" else None
        }
    
    async def handle_task_pause(self, params: dict) -> dict:
        """
        处理任务暂停
        
        Args:
            params: {
                "task_id": "uuid"
            }
            
        Returns:
            {
                "status": "paused"
            }
        """
        task_id = params.get("task_id")
        
        if not task_id:
            raise ValueError("task_id is required")
        
        # TODO: 暂停任务执行
        # TODO: 发布 TASK_PAUSED 事件
        
        return {"status": "paused"}
    
    async def handle_task_resume(self, params: dict) -> dict:
        """
        处理任务恢复
        
        Args:
            params: {
                "task_id": "uuid"
            }
            
        Returns:
            {
                "status": "resumed"
            }
        """
        task_id = params.get("task_id")
        
        if not task_id:
            raise ValueError("task_id is required")
        
        # TODO: 恢复任务执行
        # TODO: 发布 TASK_RESUMED 事件
        
        return {"status": "resumed"}
    
    async def handle_task_cancel(self, params: dict) -> dict:
        """
        处理任务取消
        
        Args:
            params: {
                "task_id": "uuid"
            }
            
        Returns:
            {
                "status": "cancelled"
            }
        """
        task_id = params.get("task_id")
        
        if not task_id:
            raise ValueError("task_id is required")
        
        # TODO: 取消任务执行
        # TODO: 清理资源
        # TODO: 发布 TASK_FAILED 事件
        
        return {"status": "cancelled"}
    
    async def handle_chat_message(self, params: dict) -> dict:
        """
        处理聊天消息
        
        Args:
            params: {
                "message": "你好",
                "session_id": "uuid"
            }
            
        Returns:
            {
                "reply": "你好！有什么可以帮助你的吗？",
                "model_id": "deepseek-v4-flash"
            }
        """
        message = params.get("message")
        session_id = params.get("session_id")
        
        if not message:
            raise ValueError("message is required")
        
        # TODO: 调用 ChatAgent 生成回复
        # TODO: 记录到会话历史
        
        return {
            "reply": "这是一个示例回复。实际实现将调用 ChatAgent。",
            "model_id": "deepseek-v4-flash"
        }
    
    async def handle_skill_execute(self, params: dict) -> dict:
        """
        处理技能执行
        
        Args:
            params: {
                "skill_id": "uuid",
                "parameters": {...}
            }
            
        Returns:
            {
                "status": "executing",
                "skill_id": "uuid"
            }
        """
        skill_id = params.get("skill_id")
        
        if not skill_id:
            raise ValueError("skill_id is required")
        
        # TODO: 查找并执行技能
        # TODO: 发布相关事件
        
        return {
            "status": "executing",
            "skill_id": skill_id
        }
