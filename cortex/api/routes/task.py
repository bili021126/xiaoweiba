"""
任务相关路由

处理任务控制（暂停、恢复、取消）等 REST API
"""
from fastapi import APIRouter
from pydantic import BaseModel


router = APIRouter()


class TaskControlRequest(BaseModel):
    """任务控制请求"""
    task_id: str


@router.post("/pause")
async def pause_task(request: TaskControlRequest):
    """暂停任务"""
    # TODO: 暂停任务
    return {"status": "paused", "task_id": request.task_id}


@router.post("/resume")
async def resume_task(request: TaskControlRequest):
    """恢复任务"""
    # TODO: 恢复任务
    return {"status": "resumed", "task_id": request.task_id}


@router.post("/cancel")
async def cancel_task(request: TaskControlRequest):
    """取消任务"""
    # TODO: 取消任务
    return {"status": "cancelled", "task_id": request.task_id}


@router.get("/{task_id}/progress")
async def get_task_progress(task_id: str):
    """获取任务进度"""
    # TODO: 查询任务进度
    return {
        "task_id": task_id,
        "progress": 0.5,
        "current_step": "代码生成",
        "total_steps": 10,
        "completed_steps": 5
    }
