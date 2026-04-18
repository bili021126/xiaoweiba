# 小尾巴代码质量检查脚本 (Windows PowerShell)
# 用法: .\scripts\check.ps1 [module-name]

param(
    [string]$Module = "all"
)

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  小尾巴 (XiaoWeiba) 代码质量检查" -ForegroundColor Cyan
Write-Host "  模块: $Module" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 1. TypeScript 类型检查
Write-Host "[1/4] TypeScript 类型检查..." -ForegroundColor Yellow
npm run compile
Write-Host "  OK 类型检查通过" -ForegroundColor Green
Write-Host ""

# 2. ESLint 代码风格检查
Write-Host "[2/4] ESLint 代码风格检查..." -ForegroundColor Yellow
npm run lint
Write-Host "  OK 代码风格检查通过" -ForegroundColor Green
Write-Host ""

# 3. 单元测试
Write-Host "[3/4] 运行单元测试..." -ForegroundColor Yellow
if ($Module -eq "all") {
    npm run test:unit
} else {
    npm run test:unit -- --testPathPattern=$Module
}
Write-Host "  OK 单元测试通过" -ForegroundColor Green
Write-Host ""

# 4. 编译输出检查
Write-Host "[4/4] 检查编译输出..." -ForegroundColor Yellow
if (Test-Path "out" -PathType Container) {
    $jsFiles = Get-ChildItem "out\*.js" -ErrorAction SilentlyContinue
    if ($jsFiles.Count -gt 0) {
        Write-Host "  OK 编译输出正常" -ForegroundColor Green
    } else {
        Write-Host "  FAIL 编译输出缺失" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  FAIL 输出目录不存在" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  所有检查通过 OK" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
