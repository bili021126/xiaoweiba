@echo off
REM Cortex Windows 快速启动脚本

echo 🚀 启动 Cortex API 服务...

REM 检查环境变量
if "%DEEPSEEK_API_KEY%"=="" (
    echo ⚠️  警告: DEEPSEEK_API_KEY 未设置
    echo 请从 .env 文件加载或手动设置环境变量
)

REM 检查依赖
where uvicorn >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ uvicorn 未安装，正在安装依赖...
    pip install -r requirements.txt
)

REM 创建数据目录
if not exist "data" mkdir data

REM 启动服务
echo ✅ 启动服务器 http://localhost:8000
echo 📖 API 文档: http://localhost:8000/docs
echo.

uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
