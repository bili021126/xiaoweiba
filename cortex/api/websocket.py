"""
WebSocket 端点处理器

处理实时双向通信，支持 JSON-RPC 2.0 协议
"""
from fastapi import WebSocket, WebSocketDisconnect
import json
from typing import Dict, Any
from api.json_rpc import JSONRPCHandler, JSONRPCRequest, JSONRPCResponse


async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket 连接处理器
    
    处理流程：
    1. 接受连接
    2. 初始化 JSON-RPC 处理器
    3. 循环接收消息
    4. 解析并处理 JSON-RPC 请求
    5. 发送响应
    
    Args:
        websocket: FastAPI WebSocket 对象
    """
    await websocket.accept()
    print("🔌 WebSocket connected")
    
    # 初始化 JSON-RPC 处理器
    # TODO: 注入实际的 event_bus 和 agent_runner
    handler = JSONRPCHandler(
        event_bus=None,  # 待实现
        agent_runner=None  # 待实现
    )
    
    try:
        while True:
            # 接收消息
            data = await websocket.receive_text()
            
            try:
                # 解析 JSON
                request_data = json.loads(data)
                
                # 验证 JSON-RPC 格式
                if not isinstance(request_data, dict) or 'method' not in request_data:
                    error_response = JSONRPCResponse(
                        id=request_data.get('id', 0),
                        error={
                            "code": -32600,
                            "message": "Invalid Request"
                        }
                    )
                    await websocket.send_text(error_response.model_dump_json())
                    continue
                
                # 创建 JSON-RPC 请求对象
                request = JSONRPCRequest(**request_data)
                
                # 处理请求
                response = await handler.handle_request(request)
                
                # 发送响应
                await websocket.send_text(response.model_dump_json())
                
            except json.JSONDecodeError:
                # JSON 解析错误
                error_response = JSONRPCResponse(
                    id=0,
                    error={
                        "code": -32700,
                        "message": "Parse error"
                    }
                )
                await websocket.send_text(error_response.model_dump_json())
                
            except Exception as e:
                # 其他错误
                print(f"❌ WebSocket error: {e}")
                error_response = JSONRPCResponse(
                    id=request_data.get('id', 0) if 'request_data' in locals() else 0,
                    error={
                        "code": -32000,
                        "message": str(e)
                    }
                )
                await websocket.send_text(error_response.model_dump_json())
    
    except WebSocketDisconnect:
        print("🔌 WebSocket disconnected")
    
    except Exception as e:
        print(f"❌ WebSocket connection error: {e}")
