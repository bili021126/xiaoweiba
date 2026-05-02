"""
聊天相关路由

处理聊天消息等 REST API
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional


router = APIRouter()


class ChatMessageRequest(BaseModel):
    """聊天消息请求"""
    message: str
    session_id: Optional[str] = None


class ChatMessageResponse(BaseModel):
    """聊天消息响应"""
    reply: str
    model_id: str


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(request: ChatMessageRequest):
    """
    发送聊天消息
    
    调用 ChatAgent 生成回复。
    """
    # TODO: 调用 ChatAgent
    return ChatMessageResponse(
        reply="这是一个示例回复。实际实现将调用 ChatAgent。",
        model_id="deepseek-v4-flash"
    )


@router.get("/sessions/{session_id}/history")
async def get_chat_history(session_id: str):
    """
    获取聊天历史
    """
    # TODO: 查询会话历史
    return {
        "session_id": session_id,
        "messages": []
    }
