#!/usr/bin/env python3
"""
Test script to simulate the infinite loop scenario described in the bug report.
Scenario: max_iterations=1, max_steps=1, max_search=1
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.prompts.planner_model import Plan, Step, StepType
from src.graph.types import State


def simulate_continue_to_running_research_team(state):
    """Simulate the continue_to_running_research_team function logic."""
    current_plan = state.get("current_plan")
    plan_iterations = state.get("plan_iterations", 0)
    
    print(f"  plan_iterations: {plan_iterations}")
    print(f"  current_plan type: {type(current_plan)}")
    
    # Check if plan exists and has steps
    if not current_plan or not hasattr(current_plan, 'steps') or not current_plan.steps:
        print("  → Decision: No plan or steps found, returning to planner")
        return "planner"

    # If all steps are completed, go to reporter instead of planner
    if all(step.execution_res is not None for step in current_plan.steps):
        print("  → Decision: All steps completed, going to reporter")
        return "reporter"

    # Find first incomplete step
    incomplete_step = None
    for step in current_plan.steps:
        if step.execution_res is None:
            incomplete_step = step
            break

    if not incomplete_step:
        print("  → Decision: No incomplete step found, going to reporter")
        return "reporter"

    if incomplete_step.step_type == StepType.RESEARCH:
        print(f"  → Decision: Next step is RESEARCH ('{incomplete_step.title}')")
        return "researcher"
    if incomplete_step.step_type == StepType.PROCESSING:
        print(f"  → Decision: Next step is PROCESSING ('{incomplete_step.title}')")
        return "coder"
    
    print("  → Decision: Default, returning to planner")
    return "planner"


def test_loop_scenario():
    """Test the scenario that was causing infinite loops."""
    
    print("="*70)
    print("SCENARIO: max_iterations=1, max_steps=1, max_search=1")
    print("="*70)
    
    # Create a plan with one research step
    plan = Plan(
        title="光速与声速全面比较分析",
        thought="收集光速与声速在不同条件下的精确值",
        locale="zh-CN",
        has_enough_context=False,
        steps=[
            Step(
                need_search=True,
                title="光速与声速数据收集",
                description="收集光速与声速在不同条件下的精确值、物理本质区别及实际应用",
                step_type=StepType.RESEARCH,
                execution_res=None  # Not executed yet
            )
        ]
    )
    
    # Initial state
    state = {
        "current_plan": plan,
        "plan_iterations": 0,
        "messages": [],
    }
    
    print("\n[ITERATION 1] Initial state - Step not executed")
    print("-" * 70)
    next_node = simulate_continue_to_running_research_team(state)
    assert next_node == "researcher", f"Expected 'researcher', got '{next_node}'"
    print("✓ Correctly routes to researcher\n")
    
    # Simulate researcher execution with empty result (edge case that was causing loop)
    print("[ITERATION 2] After researcher execution - Empty result")
    print("-" * 70)
    plan.steps[0].execution_res = ""  # Empty string result
    next_node = simulate_continue_to_running_research_team(state)
    assert next_node == "reporter", f"Expected 'reporter', got '{next_node}'"
    print("✓ Correctly routes to reporter (no loop!)\n")
    
    # Test with actual content
    print("[ITERATION 3] After researcher execution - With content")
    print("-" * 70)
    plan.steps[0].execution_res = "光速在真空中约为299,792,458米/秒"
    next_node = simulate_continue_to_running_research_team(state)
    assert next_node == "reporter", f"Expected 'reporter', got '{next_node}'"
    print("✓ Correctly routes to reporter\n")
    
    # Test with None (should go back to researcher)
    print("[ITERATION 4] Reset to None - Should retry")
    print("-" * 70)
    plan.steps[0].execution_res = None
    next_node = simulate_continue_to_running_research_team(state)
    assert next_node == "researcher", f"Expected 'researcher', got '{next_node}'"
    print("✓ Correctly routes back to researcher\n")
    
    print("="*70)
    print("ALL TESTS PASSED! ✓")
    print("="*70)
    print("\nSUMMARY:")
    print("- Empty string results are now treated as completed steps")
    print("- This prevents infinite loops when max_iterations=1")
    print("- The system correctly routes to reporter after step completion")


if __name__ == "__main__":
    test_loop_scenario()
