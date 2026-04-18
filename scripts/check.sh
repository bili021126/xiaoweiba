#!/bin/bash
# 小尾巴代码质量检查脚本
# 用法: ./scripts/check.sh [module-name]
# 如果不指定模块名，则检查全部

set -e

MODULE=${1:-all}

echo "========================================="
echo "  小尾巴 (XiaoWeiba) 代码质量检查"
echo "  模块: $MODULE"
echo "========================================="
echo ""

# 1. TypeScript 类型检查
echo "[1/4] TypeScript 类型检查..."
npm run compile
echo "  ✓ 类型检查通过"
echo ""

# 2. ESLint 代码风格检查
echo "[2/4] ESLint 代码风格检查..."
npm run lint
echo "  ✓ 代码风格检查通过"
echo ""

# 3. 单元测试
echo "[3/4] 运行单元测试..."
if [ "$MODULE" = "all" ]; then
  npm run test:unit
else
  npm run test:unit -- --testPathPattern="$MODULE"
fi
echo "  ✓ 单元测试通过"
echo ""

# 4. 编译输出检查
echo "[4/4] 检查编译输出..."
if [ -d "out" ] && [ "$(ls -A out/*.js 2>/dev/null)" ]; then
  echo "  ✓ 编译输出正常"
else
  echo "  ✗ 编译输出缺失"
  exit 1
fi

echo ""
echo "========================================="
echo "  所有检查通过 ✓"
echo "========================================="
