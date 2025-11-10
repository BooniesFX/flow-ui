# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

import asyncio
import json
import logging
import os
import re
import uuid
from functools import partial
from pathlib import Path
from typing import Annotated, Literal

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_core.language_models import BaseChatModel
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.types import Command, interrupt
from openai import BadRequestError

from src.agents import create_agent
from src.config.agents import AGENT_LLM_MAP
from src.config.configuration import Configuration
from src.llms.llm import get_llm_by_type, get_llm_token_limit_by_type
from src.config.context import get_custom_basic_model, get_custom_reasoning_model
from src.prompts.planner_model import Plan
from src.prompts.template import apply_prompt_template
from src.tools import (
    crawl_tool,
    get_retriever_tool,
    get_web_search_tool,
    python_repl_tool,
)
from src.tools.search import LoggedTavilySearch
from src.utils.context_manager import ContextManager
from src.utils.json_utils import repair_json_output

from ..config import SELECTED_SEARCH_ENGINE, SearchEngine
from .types import State

logger = logging.getLogger(__name__)


def _get_llm_for_agent(agent_type: str) -> BaseChatModel:
    """
    Get LLM instance for an agent, using frontend configuration only.
    """
    # Check if we have custom configuration from frontend
    custom_basic_model = get_custom_basic_model()
    custom_reasoning_model = get_custom_reasoning_model()
    
    # Debug logging
    logger.info(f"[DEBUG] _get_llm_for_agent called for agent_type: {agent_type}")
    logger.info(f"[DEBUG] custom_basic_model: {custom_basic_model}")
    logger.info(f"[DEBUG] custom_reasoning_model: {custom_reasoning_model}")
    
    # Map agent types to model configurations
    if agent_type == "reasoning" and custom_reasoning_model:
        # Use reasoning model configuration
        from src.llms.llm import _create_llm_use_conf
        llm = _create_llm_use_conf("reasoning", {})
        if llm is not None:
            return llm
    elif custom_basic_model:
        # Use basic model configuration for all other agents
        from src.llms.llm import _create_llm_use_conf
        llm = _create_llm_use_conf("basic", {})
        if llm is not None:
            return llm
    
    # No configuration available - require user to configure in frontend
    if agent_type == "reasoning":
        raise ValueError(
            "未配置推理模型。请在设置中配置推理模型（Reasoning Model）。\n"
            "No reasoning model configured. Please configure the Reasoning Model in settings."
        )
    else:
        raise ValueError(
            "未配置基础模型。请在设置中配置基础模型（Basic Model）。\n"
            "No basic model configured. Please configure the Basic Model in settings."
        )


def _sanitize_agent_input(agent_input: dict) -> dict:
    """Sanitize agent input to avoid triggering content inspection."""
    sanitized_input = agent_input.copy()
    
    for message in sanitized_input.get("messages", []):
        if hasattr(message, 'content') and isinstance(message.content, str):
            content = message.content
            
            # Remove HTML tags which might trigger inspection
            content = re.sub(r'<[^>]+>', '[REMOVED_CONTENT]', content)
            
            # Remove or mask sensitive information patterns
            content = re.sub(r'(?i)(password|token|key|secret)\s*[:=]\s*\S+', '[REMOVED_CREDENTIAL]', content)
            
            # Remove potential script or code injection patterns
            content = re.sub(r'(?i)(javascript:|data:|vbscript:)', '[REMOVED_PROTOCOL]', content)
            
            # Limit very long content to avoid token limits
            if len(content) > 40000:
                content = content[:40000] + "...[CONTENT_TRUNCATED]"
            
            message.content = content
    
    return sanitized_input


@tool
def handoff_to_planner(
    research_topic: Annotated[str, "The topic of the research task to be handed off."],
    locale: Annotated[str, "The user's detected language locale (e.g., en-US, zh-CN)."],
):
    """Handoff to planner agent to do plan."""
    # This tool is not returning anything: we're just using it
    # as a way for LLM to signal that it needs to hand off to planner agent
    return


@tool
def handoff_after_clarification(
    locale: Annotated[str, "The user's detected language locale (e.g., en-US, zh-CN)."],
):
    """Handoff to planner after clarification rounds are complete. Pass all clarification history to planner for analysis."""
    return


def needs_clarification(state: dict) -> bool:
    """
    Check if clarification is needed based on current state.
    Centralized logic for determining when to continue clarification.
    """
    if not state.get("enable_clarification", False):
        return False

    clarification_rounds = state.get("clarification_rounds", 0)
    is_clarification_complete = state.get("is_clarification_complete", False)
    max_clarification_rounds = state.get("max_clarification_rounds", 3)

    # Need clarification if: enabled + has rounds + not complete + not exceeded max
    # Use <= because after asking the Nth question, we still need to wait for the Nth answer
    return (
        clarification_rounds > 0
        and not is_clarification_complete
        and clarification_rounds <= max_clarification_rounds
    )


def background_investigation_node(state: State, config: RunnableConfig):
    logger.info("background investigation node is running.")
    configurable = Configuration.from_runnable_config(config)
    query = state.get("research_topic")
    background_investigation_results = None
    # Use the configured search tool instead of hardcoding TavilySearch
    from src.tools.search import get_web_search_tool
    
    
    
    search_tool = get_web_search_tool(configurable.max_search_results, configurable.search_engine)
    searched_content = search_tool.invoke(query)
    # check if the searched_content is a tuple, then we need to unpack it
    if isinstance(searched_content, tuple):
        searched_content = searched_content[0]
    if isinstance(searched_content, list):
        # Handle both old format (dict with title/content) and new format (dict with title/content or other structure)
        background_investigation_results = []
        for elem in searched_content:
            if isinstance(elem, dict):
                # Try to get title and content, with fallbacks
                title = elem.get('title') or elem.get('url', 'Unknown Title')
                content = elem.get('content') or elem.get('text', '') or str(elem)
                background_investigation_results.append(f"## {title}\n\n{content}")
            else:
                # If element is not a dict, convert to string
                background_investigation_results.append(f"## {str(elem)}")
        return {
            "background_investigation_results": "\n\n".join(
                background_investigation_results
            )
        }
    else:
        # Removed error logging to avoid console spam
        # logger.error(
        #         f"Search returned malformed response: {searched_content}"
        #     )
        background_investigation_results = str(searched_content)
    return {
        "background_investigation_results": json.dumps(
            background_investigation_results, ensure_ascii=False
        )
    }


def planner_node(
    state: State, config: RunnableConfig
) -> Command[Literal["human_feedback", "reporter"]]:
    """Planner node that generate the full plan."""
    logger.info("=" * 50)
    logger.info("PLANNER NODE STARTED")
    logger.info("=" * 50)
    configurable = Configuration.from_runnable_config(config)
    plan_iterations = state["plan_iterations"] if state.get("plan_iterations", 0) else 0
    logger.info(f"[DEBUG] planner_node: plan_iterations={plan_iterations}, max_plan_iterations={configurable.max_plan_iterations}")
    logger.info(f"[DEBUG] state keys: {list(state.keys())}")
    logger.info(f"[DEBUG] current_plan type: {type(state.get('current_plan'))}")

    # For clarification feature: only send the final clarified question to planner
    if state.get("enable_clarification", False) and state.get("clarified_question"):
        # Create a clean state with only the clarified question
        clean_state = {
            "messages": [{"role": "user", "content": state["clarified_question"]}],
            "locale": state.get("locale", "en-US"),
            "research_topic": state["clarified_question"],
        }
        messages = apply_prompt_template("planner", clean_state, configurable)
        logger.info(
            f"Clarification mode: Using clarified question: {state['clarified_question']}"
        )
    else:
        # Normal mode: use full conversation history
        messages = apply_prompt_template("planner", state, configurable)

    if state.get("enable_background_investigation") and state.get(
        "background_investigation_results"
    ):
        messages += [
            {
                "role": "user",
                "content": (
                    "background investigation results of user query:\n"
                    + state["background_investigation_results"]
                    + "\n"
                ),
            }
        ]

    if configurable.enable_deep_thinking:
        llm = _get_llm_for_agent("reasoning")
    elif AGENT_LLM_MAP["planner"] == "basic":
        # Use regular LLM without structured output to avoid validation errors
        llm = _get_llm_for_agent("basic")
    else:
        llm = _get_llm_for_agent("planner")

    # if the plan iterations is greater than the max plan iterations, return the reporter node
    if plan_iterations >= configurable.max_plan_iterations:
        logger.info(f"[DEBUG] Max iterations reached ({plan_iterations} >= {configurable.max_plan_iterations}), going to reporter")
        return Command(goto="reporter")

    full_response = ""
    if AGENT_LLM_MAP["planner"] == "basic" and not configurable.enable_deep_thinking:
        try:
            logger.info(f"[DEBUG] Invoking planner LLM without structured output")
            response = llm.invoke(messages)
            # Get the response content directly
            full_response = response.content
            logger.info(f"[DEBUG] Planner response received successfully")
        except Exception as e:
            logger.error(f"[DEBUG] Planner LLM invocation failed: {e}")
            # Try again without structured output
            logger.info(f"[DEBUG] Retrying without structured output")
            llm = _get_llm_for_agent("basic")
            response = llm.invoke(messages)
            full_response = response.content
            logger.info(f"[DEBUG] Planner response (without structured output): {full_response}")
    else:
        response = llm.stream(messages)
        for chunk in response:
            full_response += chunk.content
    logger.debug(f"Current state messages: {state['messages']}")
    logger.info(f"[DEBUG] Final planner response to be sent: {full_response[:200]}...")  # Only log first 200 chars

    try:
        curr_plan = json.loads(repair_json_output(full_response))
    except json.JSONDecodeError:
        logger.warning("Planner response is not a valid JSON")
        if plan_iterations > 0:
            return Command(goto="reporter")
        else:
            return Command(goto="__end__")
    if isinstance(curr_plan, dict) and curr_plan.get("has_enough_context"):
        logger.info("Planner response has enough context.")
        new_plan = Plan.model_validate(curr_plan)
        return Command(
            update={
                "messages": [AIMessage(content=full_response, name="planner")],
                "current_plan": new_plan,
            },
            goto="reporter",
        )
    # Parse the plan and store it as a Plan object
    try:
        curr_plan = json.loads(repair_json_output(full_response))
        if isinstance(curr_plan, dict):
            plan_obj = Plan.model_validate(curr_plan)
        else:
            plan_obj = full_response
    except Exception as e:
        logger.error(f"Error parsing plan: {e}")
        plan_obj = full_response
    
    logger.info(f"[DEBUG] Planner returning to human_feedback")
    return Command(
        update={
            "messages": [AIMessage(content=full_response, name="planner")],
            "current_plan": plan_obj,
        },
        goto="human_feedback",
    )


def human_feedback_node(
    state,
) -> Command[Literal["planner", "research_team", "reporter", "__end__"]]:
    logger.info("=" * 50)
    logger.info("HUMAN FEEDBACK NODE STARTED")
    logger.info("=" * 50)
    current_plan = state.get("current_plan", "")
    # check if the plan is auto accepted
    auto_accepted_plan = state.get("auto_accepted_plan", False)
    plan_iterations = state.get("plan_iterations", 0)
    logger.info(f"[DEBUG] human_feedback_node: auto_accepted_plan={auto_accepted_plan}")
    logger.info(f"[DEBUG] human_feedback_node: plan_iterations={plan_iterations}")
    logger.info(f"[DEBUG] current_plan type: {type(current_plan)}")
    
    # When auto_accepted_plan is False, we need to interrupt
    # The interrupt() will raise an exception the first time
    # When resumed, it will return the user's feedback
    feedback = None
    if not auto_accepted_plan:
        # Check if we're resuming from an interrupt (feedback already provided)
        interrupt_feedback = state.get("_interrupt_feedback")
        if interrupt_feedback:
            logger.info(f"[DEBUG] Resuming from interrupt with feedback: {interrupt_feedback}")
            feedback = interrupt_feedback
            # Clear the interrupt feedback to prevent infinite loops
            state["_interrupt_feedback"] = None
        else:
            logger.info("[DEBUG] Interrupting for human feedback")
            feedback = interrupt("Please Review the Plan.")
            logger.info(f"[DEBUG] Received feedback after resume: {feedback}")
    
    # Process feedback (either from auto_accept or from interrupt)
    if feedback or auto_accepted_plan:
        if str(feedback).upper().startswith("[EDIT_PLAN]"):
            logger.info("[DEBUG] User wants to edit plan, going back to planner")
            return Command(
                update={
                    "messages": [
                        HumanMessage(content=feedback, name="feedback"),
                    ],
                    "_interrupt_feedback": None,  # Clear feedback
                },
                goto="planner",
            )
        elif str(feedback).upper().startswith("[ACCEPTED]"):
            logger.info("[DEBUG] Plan accepted by user")
        else:
            # For auto_accepted_plan, feedback might be None or empty
            if auto_accepted_plan:
                logger.info("[DEBUG] Plan auto accepted")
            else:
                raise TypeError(f"Interrupt value of {feedback} is not supported.")

    # if the plan is accepted, run the following node
    plan_iterations = state.get("plan_iterations", 0)
    goto = "research_team"
    # When plan is accepted, no need to repair JSON as current_plan is already a Plan object
    plan_iterations += 1

    logger.info(f"[DEBUG] human_feedback_node: going to {goto}, plan_iterations now={plan_iterations}")
    return Command(
        update={
            "current_plan": current_plan,
            "plan_iterations": plan_iterations,
            "locale": current_plan.locale if hasattr(current_plan, 'locale') else state.get("locale", "en-US"),
        },
        goto=goto,
    )


def coordinator_node(
    state: State, config: RunnableConfig
) -> Command[Literal["planner", "background_investigator", "coordinator", "__end__"]]:
    """Coordinator node that communicate with customers and handle clarification."""
    logger.info("Coordinator talking.")
    configurable = Configuration.from_runnable_config(config)

    # Check if clarification is enabled
    enable_clarification = state.get("enable_clarification", False)

    # ============================================================
    # BRANCH 1: Clarification DISABLED (Legacy Mode)
    # ============================================================
    if not enable_clarification:
        # Use normal prompt with explicit instruction to skip clarification
        messages = apply_prompt_template("coordinator", state)
        messages.append(
            {
                "role": "system",
                "content": "CRITICAL: Clarification is DISABLED. You MUST immediately call handoff_to_planner tool with the user's query as-is. Do NOT ask questions or mention needing more information.",
            }
        )

        # Only bind handoff_to_planner tool
        tools = [handoff_to_planner]
        response = (
            _get_llm_for_agent("coordinator")
            .bind_tools(tools)
            .invoke(messages)
        )

        # Process response - should directly handoff to planner
        goto = "__end__"
        locale = state.get("locale", "en-US")
        research_topic = state.get("research_topic", "")

        # Process tool calls for legacy mode
        if response.tool_calls:
            try:
                for tool_call in response.tool_calls:
                    tool_name = tool_call.get("name", "")
                    tool_args = tool_call.get("args", {})

                    if tool_name == "handoff_to_planner":
                        logger.info("Handing off to planner")
                        goto = "planner"

                        # Extract locale and research_topic if provided
                        if tool_args.get("locale") and tool_args.get("research_topic"):
                            locale = tool_args.get("locale")
                            research_topic = tool_args.get("research_topic")
                        break

            except Exception as e:
                logger.error(f"Error processing tool calls: {e}")
                goto = "planner"

    # ============================================================
    # BRANCH 2: Clarification ENABLED (New Feature)
    # ============================================================
    else:
        # Load clarification state
        clarification_rounds = state.get("clarification_rounds", 0)
        clarification_history = state.get("clarification_history", [])
        max_clarification_rounds = state.get("max_clarification_rounds", 3)

        # Prepare the messages for the coordinator
        messages = apply_prompt_template("coordinator", state)

        # Add clarification status for first round
        if clarification_rounds == 0:
            messages.append(
                {
                    "role": "system",
                    "content": "Clarification mode is ENABLED. Follow the 'Clarification Process' guidelines in your instructions.",
                }
            )

        # Add clarification context if continuing conversation (round > 0)
        elif clarification_rounds > 0:
            logger.info(
                f"Clarification enabled (rounds: {clarification_rounds}/{max_clarification_rounds}): Continuing conversation"
            )

            # Add user's response to clarification history (only user messages)
            last_message = None
            if state.get("messages"):
                last_message = state["messages"][-1]
                # Extract content from last message for logging
                if isinstance(last_message, dict):
                    content = last_message.get("content", "No content")
                else:
                    content = getattr(last_message, "content", "No content")
                logger.info(f"Last message content: {content}")
                # Handle dict format
                if isinstance(last_message, dict):
                    if last_message.get("role") == "user":
                        clarification_history.append(last_message["content"])
                        logger.info(
                            f"Added user response to clarification history: {last_message['content']}"
                        )
                # Handle object format (like HumanMessage)
                elif hasattr(last_message, "role") and last_message.role == "user":
                    clarification_history.append(last_message.content)
                    logger.info(
                        f"Added user response to clarification history: {last_message.content}"
                    )
                # Handle object format with content attribute (like the one in logs)
                elif hasattr(last_message, "content"):
                    clarification_history.append(last_message.content)
                    logger.info(
                        f"Added user response to clarification history: {last_message.content}"
                    )

            # Build comprehensive clarification context with conversation history
            current_response = "No response"
            if last_message:
                # Handle dict format
                if isinstance(last_message, dict):
                    if last_message.get("role") == "user":
                        current_response = last_message.get("content", "No response")
                    else:
                        # If last message is not from user, try to get the latest user message
                        messages = state.get("messages", [])
                        for msg in reversed(messages):
                            if isinstance(msg, dict) and msg.get("role") == "user":
                                current_response = msg.get("content", "No response")
                                break
                # Handle object format (like HumanMessage)
                elif hasattr(last_message, "role") and last_message.role == "user":
                    current_response = last_message.content
                # Handle object format with content attribute (like the one in logs)
                elif hasattr(last_message, "content"):
                    current_response = last_message.content
                else:
                    # If last message is not from user, try to get the latest user message
                    messages = state.get("messages", [])
                    for msg in reversed(messages):
                        if isinstance(msg, dict) and msg.get("role") == "user":
                            current_response = msg.get("content", "No response")
                            break
                        elif hasattr(msg, "role") and msg.role == "user":
                            current_response = msg.content
                            break
                        elif hasattr(msg, "content"):
                            current_response = msg.content
                            break

            # Create conversation history summary
            conversation_summary = ""
            if clarification_history:
                conversation_summary = "Previous conversation:\n"
                for i, response in enumerate(clarification_history, 1):
                    conversation_summary += f"- Round {i}: {response}\n"

            clarification_context = f"""Continuing clarification (round {clarification_rounds}/{max_clarification_rounds}):
            User's latest response: {current_response}
            Ask for remaining missing dimensions. Do NOT repeat questions or start new topics."""

            # Log the clarification context for debugging
            logger.info(f"Clarification context: {clarification_context}")

            messages.append({"role": "system", "content": clarification_context})

        # Bind both clarification tools
        tools = [handoff_to_planner, handoff_after_clarification]
        response = (
            _get_llm_for_agent("coordinator")
            .bind_tools(tools)
            .invoke(messages)
        )
        logger.debug(f"Current state messages: {state['messages']}")

        # Initialize response processing variables
        goto = "__end__"
        locale = state.get("locale", "en-US")
        research_topic = state.get("research_topic", "")

        # --- Process LLM response ---
        # No tool calls - LLM is asking a clarifying question
        if not response.tool_calls and response.content:
            if clarification_rounds < max_clarification_rounds:
                # Continue clarification process
                clarification_rounds += 1
                # Do NOT add LLM response to clarification_history - only user responses
                logger.info(
                    f"Clarification response: {clarification_rounds}/{max_clarification_rounds}: {response.content}"
                )

                # Append coordinator's question to messages
                state_messages = state.get("messages", [])
                if response.content:
                    state_messages.append(
                        HumanMessage(content=response.content, name="coordinator")
                    )

                return Command(
                    update={
                        "messages": state_messages,
                        "locale": locale,
                        "research_topic": research_topic,
                        "resources": configurable.resources,
                        "clarification_rounds": clarification_rounds,
                        "clarification_history": clarification_history,
                        "is_clarification_complete": False,
                        "clarified_question": "",
                        "goto": goto,
                        "__interrupt__": [("coordinator", response.content)],
                    },
                    goto=goto,
                )
            else:
                # Max rounds reached - no more questions allowed
                logger.warning(
                    f"Max clarification rounds ({max_clarification_rounds}) reached. Handing off to planner."
                )
                goto = "planner"
                if state.get("enable_background_investigation"):
                    goto = "background_investigator"
        else:
            # LLM called a tool (handoff) or has no content - clarification complete
            if response.tool_calls:
                logger.info(
                    f"Clarification completed after {clarification_rounds} rounds. LLM called handoff tool."
                )
            else:
                logger.warning("LLM response has no content and no tool calls.")
            # goto will be set in the final section based on tool calls

    # ============================================================
    # Final: Build and return Command
    # ============================================================
    messages = state.get("messages", [])
    if response.content:
        messages.append(HumanMessage(content=response.content, name="coordinator"))

    # Process tool calls for BOTH branches (legacy and clarification)
    if response.tool_calls:
        try:
            for tool_call in response.tool_calls:
                tool_name = tool_call.get("name", "")
                tool_args = tool_call.get("args", {})

                if tool_name in ["handoff_to_planner", "handoff_after_clarification"]:
                    logger.info("Handing off to planner")
                    goto = "planner"

                    # Extract locale and research_topic if provided
                    if tool_args.get("locale") and tool_args.get("research_topic"):
                        locale = tool_args.get("locale")
                        research_topic = tool_args.get("research_topic")
                    break

        except Exception as e:
            logger.error(f"Error processing tool calls: {e}")
            goto = "planner"
    else:
        # No tool calls - both modes should goto __end__
        logger.warning("LLM didn't call any tools. Staying at __end__.")
        goto = "__end__"

    # Apply background_investigation routing if enabled (unified logic)
    if goto == "planner" and state.get("enable_background_investigation"):
        goto = "background_investigator"

    # Set default values for state variables (in case they're not defined in legacy mode)
    if not enable_clarification:
        clarification_rounds = 0
        clarification_history = []

    return Command(
        update={
            "messages": messages,
            "locale": locale,
            "research_topic": research_topic,
            "resources": configurable.resources,
            "clarification_rounds": clarification_rounds,
            "clarification_history": clarification_history,
            "is_clarification_complete": goto != "coordinator",
            "clarified_question": research_topic if goto != "coordinator" else "",
            "goto": goto,
        },
        goto=goto,
    )


def reporter_node(state: State, config: RunnableConfig):
    """Reporter node that write a final report."""
    logger.info("Reporter write final report")
    configurable = Configuration.from_runnable_config(config)
    current_plan = state.get("current_plan")
    input_ = {
        "messages": [
            HumanMessage(
                f"# Research Requirements\n\n## Task\n\n{current_plan.title}\n\n## Description\n\n{current_plan.thought}"
            )
        ],
        "locale": state.get("locale", "en-US"),
    }
    invoke_messages = apply_prompt_template("reporter", input_, configurable)
    observations = state.get("observations", [])

    # Add a reminder about the new report format, citation style, and table usage
    invoke_messages.append(
        HumanMessage(
            content="IMPORTANT: Structure your report according to the format in the prompt. Remember to include:\n\n1. Key Points - A bulleted list of the most important findings\n2. Overview - A brief introduction to the topic\n3. Detailed Analysis - Organized into logical sections\n4. Survey Note (optional) - For more comprehensive reports\n5. Key Citations - List all references at the end\n\nFor citations, DO NOT include inline citations in the text. Instead, place all citations in the 'Key Citations' section at the end using the format: `- [Source Title](URL)`. Include an empty line between each citation for better readability.\n\nPRIORITIZE USING MARKDOWN TABLES for data presentation and comparison. Use tables whenever presenting comparative data, statistics, features, or options. Structure tables with clear headers and aligned columns. Example table format:\n\n| Feature | Description | Pros | Cons |\n|---------|-------------|------|------|\n| Feature 1 | Description 1 | Pros 1 | Cons 1 |\n| Feature 2 | Description 2 | Pros 2 | Cons 2 |",
            name="system",
        )
    )

    observation_messages = []
    for observation in observations:
        observation_messages.append(
            HumanMessage(
                content=f"Below are some observations for the research task:\n\n{observation}",
                name="observation",
            )
        )

    # Context compression
    llm_token_limit = get_llm_token_limit_by_type(AGENT_LLM_MAP["reporter"])
    compressed_state = ContextManager(llm_token_limit).compress_messages(
        {"messages": observation_messages}
    )
    invoke_messages += compressed_state.get("messages", [])

    logger.debug(f"Current invoke messages: {invoke_messages}")
    response = _get_llm_for_agent("reporter").invoke(invoke_messages)
    response_content = response.content
    logger.info(f"reporter response: {response_content}")

    # Save report to file
    import uuid
    import os
    from pathlib import Path
    
    # Create reports directory if it doesn't exist
    reports_dir = Path("reports")
    reports_dir.mkdir(exist_ok=True)
    
    # Generate report ID and filename
    report_id = str(uuid.uuid4())[:8]
    report_file = reports_dir / f"{report_id}.md"
    
    # Write report content to file
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(response_content)
    
    logger.info(f"Report saved to: {report_file}")

    return {"final_report": response_content}


def research_team_node(state: State):
    """Research team node that collaborates on tasks."""
    logger.info("Research team is collaborating on tasks.")
    pass


async def _execute_agent_step(
    state: State, agent, agent_name: str
) -> Command[Literal["research_team"]]:
    """Helper function to execute a step using the specified agent."""
    current_plan = state.get("current_plan")
    plan_title = current_plan.title
    observations = state.get("observations", [])

    # Find the first unexecuted step
    current_step = None
    completed_steps = []
    for step in current_plan.steps:
        if step.execution_res is None:
            current_step = step
            break
        else:
            completed_steps.append(step)

    if not current_step:
        logger.warning("No unexecuted step found")
        # All steps are completed, go to reporter
        return Command(goto="reporter")

    logger.info(f"Executing step: {current_step.title}, agent: {agent_name}")

    # Format completed steps information
    completed_steps_info = ""
    if completed_steps:
        completed_steps_info = "# Completed Research Steps\n\n"
        for i, step in enumerate(completed_steps):
            completed_steps_info += f"## Completed Step {i + 1}: {step.title}\n\n"
            completed_steps_info += f"<finding>\n{step.execution_res}\n</finding>\n\n"

    # Prepare the input for the agent with completed steps info
    agent_input = {
        "messages": [
            HumanMessage(
                content=f"# Research Topic\n\n{plan_title}\n\n{completed_steps_info}# Current Step\n\n## Title\n\n{current_step.title}\n\n## Description\n\n{current_step.description}\n\n## Locale\n\n{state.get('locale', 'en-US')}"
            )
        ]
    }

    # Add citation reminder for researcher agent
    if agent_name == "researcher":
        if state.get("resources"):
            resources_info = "**The user mentioned the following resource files:**\n\n"
            for resource in state.get("resources"):
                resources_info += f"- {resource.title} ({resource.description})\n"

            agent_input["messages"].append(
                HumanMessage(
                    content=resources_info
                    + "\n\n"
                    + "You MUST use the **local_search_tool** to retrieve the information from the resource files.",
                )
            )

        agent_input["messages"].append(
            HumanMessage(
                content="IMPORTANT: DO NOT include inline citations in the text. Instead, track all sources and include a References section at the end using link reference format. Include an empty line between each citation for better readability. Use this format for each reference:\n- [Source Title](URL)\n\n- [Another Source](URL)",
                name="system",
            )
        )

    # Invoke the agent
    default_recursion_limit = 25
    try:
        env_value_str = os.getenv("AGENT_RECURSION_LIMIT", str(default_recursion_limit))
        parsed_limit = int(env_value_str)

        if parsed_limit > 0:
            recursion_limit = parsed_limit
            logger.info(f"Recursion limit set to: {recursion_limit}")
        else:
            logger.warning(
                f"AGENT_RECURSION_LIMIT value '{env_value_str}' (parsed as {parsed_limit}) is not positive. "
                f"Using default value {default_recursion_limit}."
            )
            recursion_limit = default_recursion_limit
    except ValueError:
        raw_env_value = os.getenv("AGENT_RECURSION_LIMIT")
        logger.warning(
            f"Invalid AGENT_RECURSION_LIMIT value: '{raw_env_value}'. "
            f"Using default value {default_recursion_limit}."
        )
        recursion_limit = default_recursion_limit

    # Removed info logging to avoid console spam
    # logger.info(f"Agent input: {agent_input}")
    
    # Generate request ID for tracking
    request_id = str(uuid.uuid4())[:8]
    logger.info(f"Executing agent step {agent_name} with request_id: {request_id}")
    logger.info(f"[DEBUG] Step execution_res before: {current_step.execution_res}")
    
    # Retry logic with exponential backoff
    max_retries = 3
    base_delay = 1
    result = None
    
    for attempt in range(max_retries):
        try:
            # Use sanitized input on second attempt
            current_agent_input = agent_input
            if attempt == 1:
                current_agent_input = _sanitize_agent_input(agent_input)
                logger.info(f"Request {request_id}: Using sanitized input on attempt {attempt + 1}")
            
            result = await agent.ainvoke(
                input=current_agent_input, config={"recursion_limit": recursion_limit}
            )
            break  # Success, exit retry loop
            
        except BadRequestError as e:
            if "data_inspection_failed" in str(e) and attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)  # Exponential backoff
                logger.warning(f"Request {request_id}: Content inspection failed on attempt {attempt + 1}, retrying in {delay}s... Error: {e}")
                await asyncio.sleep(delay)
                continue
            else:
                logger.error(f"Request {request_id}: Content inspection failed after {max_retries} attempts: {e}")
                # Return a safe fallback response
                fallback_content = f"I apologize, but I encountered content restrictions while processing: '{current_step.title}'. This could be due to sensitive content in the research materials. Please try rephrasing your query or provide different research parameters."
                current_step.execution_res = fallback_content
                return Command(
                    update={
                        "messages": [
                            HumanMessage(
                                content=fallback_content,
                                name=agent_name,
                            )
                        ],
                        "current_plan": current_plan,  # Update the plan with execution results
                    },
                    goto="research_team",
                )
        except Exception as e:
            logger.error(f"Request {request_id}: Unexpected error on attempt {attempt + 1}: {e}")
            if attempt == max_retries - 1:
                fallback_content = f"I encountered an unexpected error while processing: '{current_step.title}'. Please try again or contact support if the issue persists."
                current_step.execution_res = fallback_content
                return Command(
                    update={
                        "messages": [
                            HumanMessage(
                                content=fallback_content,
                                name=agent_name,
                            )
                        ],
                        "current_plan": current_plan,  # Update the plan with execution results
                    },
                    goto="research_team",
                )
            await asyncio.sleep(base_delay * (2 ** attempt))
    
    if not result:
        raise RuntimeError(f"Failed to execute agent step after {max_retries} attempts")

    # Process the result
    response_content = result["messages"][-1].content
    # Removed debug logging to avoid console spam
    # logger.debug(f"{agent_name.capitalize()} full response: {response_content}")

    # Update the step with the execution result
    current_step.execution_res = response_content
    logger.info(f"Step '{current_step.title}' execution completed by {agent_name}")
    logger.info(f"[DEBUG] Step execution_res after: {current_step.execution_res is not None}, length: {len(response_content) if response_content else 0}")

    return Command(
        update={
            "messages": [
                HumanMessage(
                    content=response_content,
                    name=agent_name,
                )
            ],
            "observations": observations + [response_content],
            "current_plan": current_plan,  # Update the plan with execution results
        },
        goto="research_team",
    )


async def _setup_and_execute_agent_step(
    state: State,
    config: RunnableConfig,
    agent_type: str,
    default_tools: list,
) -> Command[Literal["research_team"]]:
    """Helper function to set up an agent with appropriate tools and execute a step.

    This function handles the common logic for both researcher_node and coder_node:
    1. Configures MCP servers and tools based on agent type
    2. Creates an agent with the appropriate tools or uses the default agent
    3. Executes the agent on the current step

    Args:
        state: The current state
        config: The runnable config
        agent_type: The type of agent ("researcher" or "coder")
        default_tools: The default tools to add to the agent

    Returns:
        Command to update state and go to research_team
    """
    configurable = Configuration.from_runnable_config(config)
    mcp_servers = {}
    enabled_tools = {}

    # Extract MCP server configuration for this agent type
    if configurable.mcp_settings:
        for server_name, server_config in configurable.mcp_settings["servers"].items():
            if (
                server_config["enabled_tools"]
                and agent_type in server_config["add_to_agents"]
            ):
                mcp_servers[server_name] = {
                    k: v
                    for k, v in server_config.items()
                    if k in ("transport", "command", "args", "url", "env", "headers")
                }
                for tool_name in server_config["enabled_tools"]:
                    enabled_tools[tool_name] = server_name

    # Create and execute agent with MCP tools if available
    if mcp_servers:
        client = MultiServerMCPClient(mcp_servers)
        loaded_tools = default_tools[:]
        all_tools = await client.get_tools()
        for tool in all_tools:
            if tool.name in enabled_tools:
                tool.description = (
                    f"Powered by '{enabled_tools[tool.name]}'.\n{tool.description}"
                )
                loaded_tools.append(tool)

        llm_token_limit = get_llm_token_limit_by_type(AGENT_LLM_MAP[agent_type])
        pre_model_hook = partial(ContextManager(llm_token_limit, 3).compress_messages)
        agent = create_agent(
            agent_type, agent_type, loaded_tools, agent_type, pre_model_hook
        )
        return await _execute_agent_step(state, agent, agent_type)
    else:
        # Use default tools if no MCP servers are configured
        llm_token_limit = get_llm_token_limit_by_type(AGENT_LLM_MAP[agent_type])
        pre_model_hook = partial(ContextManager(llm_token_limit, 3).compress_messages)
        agent = create_agent(
            agent_type, agent_type, default_tools, agent_type, pre_model_hook
        )
        return await _execute_agent_step(state, agent, agent_type)


async def researcher_node(
    state: State, config: RunnableConfig
) -> Command[Literal["research_team"]]:
    """Researcher node that do research"""
    logger.info("Researcher node is researching.")
    configurable = Configuration.from_runnable_config(config)
    tools = [get_web_search_tool(configurable.max_search_results, configurable.search_engine), crawl_tool]
    retriever_tool = get_retriever_tool(state.get("resources", []))
    if retriever_tool:
        tools.insert(0, retriever_tool)
    # Removed info logging to avoid console spam
    # logger.info(f"Researcher tools: {tools}")
    return await _setup_and_execute_agent_step(
        state,
        config,
        "researcher",
        tools,
    )


async def coder_node(
    state: State, config: RunnableConfig
) -> Command[Literal["research_team"]]:
    """Coder node that do code analysis."""
    logger.info("Coder node is coding.")
    return await _setup_and_execute_agent_step(
        state,
        config,
        "coder",
        [python_repl_tool],
    )
