"""
蓝图相关路由

处理蓝图生成、确认等 REST API
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional


router = APIRouter()


class BlueprintConfirmRequest(BaseModel):
    """蓝图确认请求"""
    blueprint_id: str
    action: str  # "confirm" | "modify" | "reject"


@router.post("/confirm")
async def confirm_blueprint(request: BlueprintConfirmRequest):
    """
    确认蓝图
    
    用户确认、修改或拒绝生成的蓝图。
    """
    # TODO: 更新蓝图状态
    return {
        "status": request.action,
        "blueprint_id": request.blueprint_id
    }


@router.get("/{blueprint_id}")
async def get_blueprint(blueprint_id: str):
    """
    获取蓝图详情
    """
    # TODO: 查询蓝图
    return {
        "id": blueprint_id,
        "project_name": "示例项目",
        "summary": "这是一个示例蓝图"
    }
