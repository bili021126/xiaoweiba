"""
概念相关路由

处理概念提交、澄清等 REST API
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional


router = APIRouter()


class ConceptSubmitRequest(BaseModel):
    """概念提交请求"""
    user_input: str
    session_id: Optional[str] = None


class ConceptSubmitResponse(BaseModel):
    """概念提交响应"""
    concept_id: str
    clarification_questions: List[str]
    missing_info: List[str]


@router.post("/submit", response_model=ConceptSubmitResponse)
async def submit_concept(request: ConceptSubmitRequest):
    """
    提交概念
    
    将用户的模糊概念转化为结构化的概念对象，
    并返回需要澄清的问题和缺失信息。
    """
    # TODO: 调用 ConceptParser
    return ConceptSubmitResponse(
        concept_id="temp-concept-id",
        clarification_questions=[
            "你需要用户注册登录功能吗？",
            "你偏好的技术栈是什么？"
        ],
        missing_info=["tech_stack", "deployment_target"]
    )


class ConceptClarifyRequest(BaseModel):
    """概念澄清请求"""
    concept_id: str
    answers: dict


@router.post("/clarify", response_model=dict)
async def clarify_concept(request: ConceptClarifyRequest):
    """
    澄清概念
    
    用户回答澄清问题后，更新概念信息。
    """
    # TODO: 更新概念
    return {
        "status": "clarified",
        "concept_id": request.concept_id
    }
