"""
FastAPI 主应用入口

提供 REST API 和 WebSocket 接口
遵循 Cortex 架构法典 DEP-001 ~ DEP-004
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import yaml
import os
from typing import Dict, Any

# 导入路由
from api.routes import concept, blueprint, task, chat
from api.websocket import websocket_endpoint


# 全局配置
config: Dict[str, Any] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    
    启动时：
    - 加载配置文件
    - 初始化数据库连接
    - 注册 Agent
    
    关闭时：
    - 关闭数据库连接
    - 清理资源
    """
    # 启动时执行
    print("🚀 Starting Cortex API...")
    
    # 加载配置
    global config
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config.yaml')
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    print(f"✅ Configuration loaded from {config_path}")
    print(f"   Model: {config['model']['default']}")
    print(f"   Host: {config['api']['host']}:{config['api']['port']}")
    
    # TODO: 初始化数据库连接
    # TODO: 注册 Agent
    
    yield
    
    # 关闭时执行
    print("\n🛑 Shutting down Cortex API...")
    # TODO: 关闭数据库连接
    print("✅ Cortex API stopped")


# 创建 FastAPI 应用
app = FastAPI(
    title="Cortex API",
    description="Cortex - 思想熔炉，概念创造平台",
    version="0.1.0",
    lifespan=lifespan
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.get('api', {}).get('cors_origins', ['*']),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由注册
app.include_router(concept.router, prefix="/api/concept", tags=["concept"])
app.include_router(blueprint.router, prefix="/api/blueprint", tags=["blueprint"])
app.include_router(task.router, prefix="/api/task", tags=["task"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])

# WebSocket 端点
@app.websocket("/ws")
async def websocket_route(websocket: WebSocket):
    await websocket_endpoint(websocket)


# 健康检查端点
@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "model": config.get('model', {}).get('default', 'unknown')
    }


# 根路径
@app.get("/")
async def root():
    """根路径"""
    return {
        "name": "Cortex API",
        "version": "0.1.0",
        "docs": "/docs",
        "websocket": "/ws"
    }


if __name__ == "__main__":
    import uvicorn
    
    host = config.get('api', {}).get('host', '0.0.0.0')
    port = config.get('api', {}).get('port', 8000)
    debug = config.get('api', {}).get('debug', False)
    
    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        reload=debug
    )
