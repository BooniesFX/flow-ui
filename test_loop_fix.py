#!/usr/bin/env python3
"""
Test script to verify the infinite loop fix.
This simulates the scenario where max_iterations=1, max_steps=1, max_search=1
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.prompts.planner_model import Plan, Step, StepType


def test_step_completion_check():
    """Test that step completion is correctly detected even with empty string results."""
    
    # Create a plan with one step
    plan = Plan(
        title="Test Plan",
        thought="Test thought",
        locale="zh-CN",
        has_enough_context=False,
        steps=[
            Step(
                need_search=True,
                title="Research Step",
                description="Do research",
                step_type=StepType.RESEARCH,
                execution_res=None  # Not executed yet
            )
        ]
    )
    
    # Test 1: Step with None should be considered incomplete
    print("Test 1: Step with execution_res=None")
    incomplete_steps = [step for step in plan.steps if step.execution_res is None]
    print(f"  Incomplete steps: {len(incomplete_steps)}")
    assert len(incomplete_steps) == 1, "Should have 1 incomplete step"
    print("  ✓ PASS")
    
    # Test 2: Step with empty string should be considered complete
    print("\nTest 2: Step with execution_res='' (empty string)")
    plan.steps[0].execution_res = ""
    incomplete_steps = [step for step in plan.steps if step.execution_res is None]
    print(f"  Incomplete steps: {len(incomplete_steps)}")
    assert len(incomplete_steps) == 0, "Should have 0 incomplete steps"
    all_complete = all(step.execution_res is not None for step in plan.steps)
    print(f"  All steps complete: {all_complete}")
    assert all_complete, "All steps should be marked as complete"
    print("  ✓ PASS")
    
    # Test 3: Step with actual content should be considered complete
    print("\nTest 3: Step with execution_res='Some result'")
    plan.steps[0].execution_res = "Some result"
    incomplete_steps = [step for step in plan.steps if step.execution_res is None]
    print(f"  Incomplete steps: {len(incomplete_steps)}")
    assert len(incomplete_steps) == 0, "Should have 0 incomplete steps"
    all_complete = all(step.execution_res is not None for step in plan.steps)
    print(f"  All steps complete: {all_complete}")
    assert all_complete, "All steps should be marked as complete"
    print("  ✓ PASS")
    
    # Test 4: Multiple steps with mixed completion status
    print("\nTest 4: Multiple steps with mixed completion")
    plan.steps.append(
        Step(
            need_search=False,
            title="Second Step",
            description="Another step",
            step_type=StepType.PROCESSING,
            execution_res=None
        )
    )
    incomplete_steps = [step for step in plan.steps if step.execution_res is None]
    print(f"  Incomplete steps: {len(incomplete_steps)}")
    assert len(incomplete_steps) == 1, "Should have 1 incomplete step"
    all_complete = all(step.execution_res is not None for step in plan.steps)
    print(f"  All steps complete: {all_complete}")
    assert not all_complete, "Not all steps should be complete"
    print("  ✓ PASS")
    
    print("\n" + "="*50)
    print("All tests passed! ✓")
    print("="*50)


if __name__ == "__main__":
    test_step_completion_check()
