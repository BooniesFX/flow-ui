#!/bin/bash
# 验证死循环修复的脚本

echo "=========================================="
echo "验证死循环修复"
echo "=========================================="
echo ""

echo "运行测试 1: 步骤完成状态检查..."
uv run python test_loop_fix.py
if [ $? -eq 0 ]; then
    echo "✓ 测试 1 通过"
else
    echo "✗ 测试 1 失败"
    exit 1
fi

echo ""
echo "运行测试 2: 循环场景模拟..."
uv run python test_loop_scenario.py
if [ $? -eq 0 ]; then
    echo "✓ 测试 2 通过"
else
    echo "✗ 测试 2 失败"
    exit 1
fi

echo ""
echo "=========================================="
echo "所有测试通过！修复验证成功 ✓"
echo "=========================================="
echo ""
echo "修复内容："
echo "1. 修复了步骤完成状态判断 (使用 is not None 而不是 truthiness)"
echo "2. 修复了错误处理缺少 goto 参数的问题"
echo "3. 确保在 max_iterations=1 时不会出现死循环"
echo ""
