# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

import logging
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from typing import Optional

from src.prompts.planner_model import StepType

from .nodes import (
    background_investigation_node,
    coder_node,
    coordinator_node,
    human_feedback_node,
    planner_node,
    reporter_node,
    research_team_node,
    researcher_node,
)
from .types import State


def continue_to_running_research_team(state: State):
    logger = logging.getLogger(__name__)
    logger.info("=" * 50)
    logger.info("CONTINUE TO RUNNING RESEARCH TEAM")
    logger.info("=" * 50)
    current_plan = state.get("current_plan")
    plan_iterations = state.get("plan_iterations", 0)
    
    # Log for debugging
    logger.info(f"[DEBUG] continue_to_running_research_team: plan_iterations={plan_iterations}, current_plan_type={type(current_plan)}")
    logger.info(f"[DEBUG] state keys: {list(state.keys())}")
    
    # Check if current_plan is string and log its content
    if isinstance(current_plan, str):
        logger.info(f"[DEBUG] current_plan is string, first 100 chars: {current_plan[:100]}")
    elif hasattr(current_plan, 'steps'):
        logger.info(f"[DEBUG] current_plan has {len(current_plan.steps)} steps")
    
    # Check if plan exists and has steps
    if not current_plan or not hasattr(current_plan, 'steps') or not current_plan.steps:
        logger.warning("No plan or steps found, returning to planner")
        return "planner"

    # If all steps are completed, go to reporter instead of planner
    if all(step.execution_res for step in current_plan.steps):
        logger.info("All steps completed, going to reporter")
        return "reporter"

    # Find first incomplete step
    incomplete_step = None
    for step in current_plan.steps:
        if not step.execution_res:
            incomplete_step = step
            break

    if not incomplete_step:
        logger.info("No incomplete step found, going to reporter")
        return "reporter"

    if incomplete_step.step_type == StepType.RESEARCH:
        logger.info("Next step is RESEARCH")
        return "researcher"
    if incomplete_step.step_type == StepType.PROCESSING:
        logger.info("Next step is PROCESSING")
        return "coder"
    return "planner"


def _build_base_graph():
    """Build and return the base state graph with all nodes and edges."""
    builder = StateGraph(State)
    builder.add_edge(START, "coordinator")
    builder.add_node("coordinator", coordinator_node)
    builder.add_node("background_investigator", background_investigation_node)
    builder.add_node("planner", planner_node)
    builder.add_node("reporter", reporter_node)
    builder.add_node("research_team", research_team_node)
    builder.add_node("researcher", researcher_node)
    builder.add_node("coder", coder_node)
    builder.add_node("human_feedback", human_feedback_node)
    builder.add_edge("background_investigator", "planner")
    builder.add_conditional_edges(
        "research_team",
        continue_to_running_research_team,
        ["planner", "researcher", "coder", "reporter"],
    )
    builder.add_edge("reporter", END)
    # Add conditional edges for coordinator to handle clarification flow
    builder.add_conditional_edges(
        "coordinator",
        lambda state: state.get("goto", "planner"),
        ["planner", "background_investigator", "coordinator", END],
    )
    return builder


from typing import Optional

def build_graph_with_memory(
    basic_model: Optional[dict] = None,
    reasoning_model: Optional[dict] = None,
    search_engine: Optional[dict] = None,
):
    """Build and return the agent workflow graph with memory."""
    # use persistent memory to save conversation history
    # TODO: be compatible with SQLite / PostgreSQL
    memory = MemorySaver()

    # build state graph
    builder = _build_base_graph()
    return builder.compile(checkpointer=memory)


def build_graph():
    """Build and return the agent workflow graph without memory."""
    # build state graph
    builder = _build_base_graph()
    return builder.compile()


graph = build_graph()
