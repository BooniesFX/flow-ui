# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

import asyncio
import base64
import json
import logging
import os
import glob
from typing import Annotated, Any, List, Optional, cast
from uuid import uuid4
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from langchain_core.messages import AIMessageChunk, BaseMessage, ToolMessage
from langgraph.checkpoint.mongodb import AsyncMongoDBSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.memory import InMemoryStore
from langgraph.types import Command
from psycopg_pool import AsyncConnectionPool

from src.config.configuration import get_recursion_limit
from src.config.loader import get_bool_env, get_str_env
from src.config.report_style import ReportStyle
from src.config.tools import SELECTED_RAG_PROVIDER
from src.graph.builder import build_graph_with_memory
from src.graph.checkpoint import chat_stream_message
from src.llms.llm import get_configured_llm_models
from src.podcast.graph.builder import build_graph as build_podcast_graph
from src.ppt.graph.builder import build_graph as build_ppt_graph
from src.prompt_enhancer.graph.builder import build_graph as build_prompt_enhancer_graph
from src.prose.graph.builder import build_graph as build_prose_graph
from src.rag.builder import build_retriever
from src.rag.milvus import load_examples
from src.rag.retriever import Resource
from src.server.chat_request import (
    ChatRequest,
    EnhancePromptRequest,
    GeneratePodcastRequest,
    GeneratePPTRequest,
    GenerateProseRequest,
    TTSRequest,
)
from src.server.config_request import ConfigResponse
from src.server.mcp_request import MCPServerMetadataRequest, MCPServerMetadataResponse
from src.server.mcp_utils import load_mcp_tools
from src.server.rag_request import (
    RAGConfigResponse,
    RAGResourceRequest,
    RAGResourcesResponse,
)
from src.tools.siliconflow_tts import SiliconFlowTTS
from src.utils.json_utils import sanitize_args

logger = logging.getLogger(__name__)

# Configure Windows event loop policy for PostgreSQL compatibility
# On Windows, psycopg requires a selector-based event loop, not the default ProactorEventLoop
if os.name == "nt":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

INTERNAL_SERVER_ERROR_DETAIL = "Internal Server Error"

app = FastAPI(
    title="Deep Research API",
    description="API for Deep Research",
    version="0.1.0",
)

# Add CORS middleware
# It's recommended to load the allowed origins from an environment variable
# for better security and flexibility across different environments.
allowed_origins_str = get_str_env("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",")]

logger.info(f"Allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Restrict to specific origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # Use the configured list of methods
    allow_headers=["*"],  # Now allow all headers, but can be restricted further
)

# Load examples into Milvus if configured
load_examples()

in_memory_store = InMemoryStore()
graph = build_graph_with_memory()


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    # Check if MCP server configuration is enabled
    mcp_enabled = get_bool_env("ENABLE_MCP_SERVER_CONFIGURATION", False)

    # Validate MCP settings if provided
    if request.mcp_settings and not mcp_enabled:
        raise HTTPException(
            status_code=403,
            detail="MCP server configuration is disabled. Set ENABLE_MCP_SERVER_CONFIGURATION=true to enable MCP features.",
        )

    thread_id = request.thread_id
    if thread_id == "__default__":
        thread_id = str(uuid4())

    return StreamingResponse(
        _astream_workflow_generator(
            request.model_dump()["messages"],
            thread_id,
            request.resources,
            request.max_plan_iterations,
            request.max_step_num,
            request.max_search_results,
            request.auto_accepted_plan,
            request.interrupt_feedback,
            request.mcp_settings if mcp_enabled else {},
            request.enable_background_investigation,
            request.report_style,
            request.enable_deep_thinking,
            request.enable_clarification,
            request.max_clarification_rounds,
            request.basic_model,
            request.reasoning_model,
            request.search_engine,
        ),
        media_type="text/event-stream",
    )


def _validate_tool_call_chunks(tool_call_chunks):
    """Validate and log tool call chunk structure for debugging."""
    if not tool_call_chunks:
        return
    
    # Removed debug logging to avoid console spam
    # logger.debug(f"Validating tool_call_chunks: count={len(tool_call_chunks)}")
    
    indices_seen = set()
    tool_ids_seen = set()
    
    for i, chunk in enumerate(tool_call_chunks):
        index = chunk.get("index")
        tool_id = chunk.get("id")
        name = chunk.get("name", "")
        has_args = "args" in chunk
        
        # Removed debug logging to avoid console spam
        # logger.debug(
        #     f"Chunk {i}: index={index}, id={tool_id}, name={name}, "
        #     f"has_args={has_args}, type={chunk.get('type')}"
        # )
        
        if index is not None:
            indices_seen.add(index)
        if tool_id:
            tool_ids_seen.add(tool_id)
    
    if len(indices_seen) > 1:
        logger.debug(
            f"Multiple indices detected: {sorted(indices_seen)} - "
            f"This may indicate consecutive tool calls"
        )


def _process_tool_call_chunks(tool_call_chunks):
    """
    Process tool call chunks with proper index-based grouping.
    
    This function handles the concatenation of tool call chunks that belong
    to the same tool call (same index) while properly segregating chunks
    from different tool calls (different indices).
    
    The issue: In streaming, LangChain's ToolCallChunk concatenates string
    attributes (name, args) when chunks have the same index. We need to:
    1. Group chunks by index
    2. Detect index collisions with different tool names
    3. Accumulate arguments for the same index
    4. Return properly segregated tool calls
    """
    if not tool_call_chunks:
        return []
    
    _validate_tool_call_chunks(tool_call_chunks)
    
    chunks = []
    chunk_by_index = {}  # Group chunks by index to handle streaming accumulation
    
    for chunk in tool_call_chunks:
        index = chunk.get("index")
        chunk_id = chunk.get("id")
        
        if index is not None:
            # Create or update entry for this index
            if index not in chunk_by_index:
                chunk_by_index[index] = {
                    "name": "",
                    "args": "",
                    "id": chunk_id or "",
                    "index": index,
                    "type": chunk.get("type", ""),
                }
            
            # Validate and accumulate tool name
            chunk_name = chunk.get("name", "")
            if chunk_name:
                stored_name = chunk_by_index[index]["name"]
                
                # Check for index collision with different tool names
                if stored_name and stored_name != chunk_name:
                    logger.warning(
                        f"Tool name mismatch detected at index {index}: "
                        f"'{stored_name}' != '{chunk_name}'. "
                        f"This may indicate a streaming artifact or consecutive tool calls "
                        f"with the same index assignment."
                    )
                    # Keep the first name to prevent concatenation
                else:
                    chunk_by_index[index]["name"] = chunk_name
            
            # Update ID if new one provided
            if chunk_id and not chunk_by_index[index]["id"]:
                chunk_by_index[index]["id"] = chunk_id
            
            # Accumulate arguments
            if chunk.get("args"):
                chunk_by_index[index]["args"] += chunk.get("args", "")
        else:
            # Handle chunks without explicit index (edge case)
            # Removed debug logging to avoid console spam
            # logger.debug(f"Chunk without index encountered: {chunk}")
            chunks.append({
                "name": chunk.get("name", ""),
                "args": sanitize_args(chunk.get("args", "")),
                "id": chunk.get("id", ""),
                "index": 0,
                "type": chunk.get("type", ""),
            })
    
    # Convert indexed chunks to list, sorted by index for proper order
    for index in sorted(chunk_by_index.keys()):
        chunk_data = chunk_by_index[index]
        chunk_data["args"] = sanitize_args(chunk_data["args"])
        chunks.append(chunk_data)
        # Removed debug logging to avoid console spam
        # logger.debug(
        #     f"Processed tool call: index={index}, name={chunk_data['name']}, "
        #     f"id={chunk_data['id']}"
        # )
    
    return chunks


def _get_agent_name(agent, message_metadata):
    """Extract agent name from agent tuple."""
    agent_name = "unknown"
    if agent and len(agent) > 0:
        agent_name = agent[0].split(":")[0] if ":" in agent[0] else agent[0]
    else:
        agent_name = message_metadata.get("langgraph_node", "unknown")
    return agent_name


def _create_event_stream_message(
    message_chunk, message_metadata, thread_id, agent_name
):
    """Create base event stream message."""
    event_stream_message = {
        "thread_id": thread_id,
        "agent": agent_name,
        "id": message_chunk.id,
        "role": "assistant",
        "checkpoint_ns": message_metadata.get("checkpoint_ns", ""),
        "langgraph_node": message_metadata.get("langgraph_node", ""),
        "langgraph_path": message_metadata.get("langgraph_path", ""),
        "langgraph_step": message_metadata.get("langgraph_step", ""),
        "content": message_chunk.content,
    }

    # Add optional fields
    if message_chunk.additional_kwargs.get("reasoning_content"):
        event_stream_message["reasoning_content"] = message_chunk.additional_kwargs[
            "reasoning_content"
        ]

    if message_chunk.response_metadata.get("finish_reason"):
        event_stream_message["finish_reason"] = message_chunk.response_metadata.get(
            "finish_reason"
        )

    return event_stream_message


def _create_interrupt_event(thread_id, event_data):
    """Create interrupt event."""
    return _make_event(
        "interrupt",
        {
            "thread_id": thread_id,
            "id": event_data["__interrupt__"][0].ns[0],
            "role": "assistant",
            "content": event_data["__interrupt__"][0].value,
            "finish_reason": "interrupt",
            "options": [
                {"text": "Edit plan", "value": "edit_plan"},
                {"text": "Start research", "value": "accepted"},
            ],
        },
    )


def _process_initial_messages(message, thread_id):
    """Process initial messages and yield formatted events."""
    json_data = json.dumps(
        {
            "thread_id": thread_id,
            "id": "run--" + message.get("id", uuid4().hex),
            "role": "user",
            "content": message.get("content", ""),
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    chat_stream_message(
        thread_id, f"event: message_chunk\ndata: {json_data}\n\n", "none"
    )


async def _process_message_chunk(message_chunk, message_metadata, thread_id, agent):
    """Process a single message chunk and yield appropriate events."""
    agent_name = _get_agent_name(agent, message_metadata)
    event_stream_message = _create_event_stream_message(
        message_chunk, message_metadata, thread_id, agent_name
    )

    if isinstance(message_chunk, ToolMessage):
        # Tool Message - Return the result of the tool call
        tool_call_id = message_chunk.tool_call_id
        event_stream_message["tool_call_id"] = tool_call_id
        
        # Validate tool_call_id for debugging
        if tool_call_id:
            # Removed debug logging to avoid console spam
            # logger.debug(f"Processing ToolMessage with tool_call_id: {tool_call_id}")
            pass
        else:
            logger.warning("ToolMessage received without tool_call_id")
        
        yield _make_event("tool_call_result", event_stream_message)
    elif isinstance(message_chunk, AIMessageChunk):
        # AI Message - Raw message tokens
        if message_chunk.tool_calls:
            # AI Message - Tool Call (complete tool calls)
            event_stream_message["tool_calls"] = message_chunk.tool_calls
            
            # Process tool_call_chunks with proper index-based grouping
            processed_chunks = _process_tool_call_chunks(
                message_chunk.tool_call_chunks
            )
            if processed_chunks:
                event_stream_message["tool_call_chunks"] = processed_chunks
                # Removed debug logging to avoid console spam
                # logger.debug(
                #     f"Tool calls: {[tc.get('name') for tc in message_chunk.tool_calls]}, "
                #     f"Processed chunks: {len(processed_chunks)}"
                # )
            
            yield _make_event("tool_calls", event_stream_message)
        elif message_chunk.tool_call_chunks:
            # AI Message - Tool Call Chunks (streaming)
            processed_chunks = _process_tool_call_chunks(
                message_chunk.tool_call_chunks
            )
            
            # Emit separate events for chunks with different indices (tool call boundaries)
            if processed_chunks:
                prev_chunk = None
                for chunk in processed_chunks:
                    current_index = chunk.get("index")
                    
                    # Log index transitions to detect tool call boundaries
                    if prev_chunk is not None and current_index != prev_chunk.get("index"):
                        # Removed debug logging to avoid console spam
                        # logger.debug(
                        #     f"Tool call boundary detected: "
                        #     f"index {prev_chunk.get('index')} ({prev_chunk.get('name')}) -> "
                        #     f"{current_index} ({chunk.get('name')})"
                        # )
                        pass
                    
                    prev_chunk = chunk
                
                # Include all processed chunks in the event
                event_stream_message["tool_call_chunks"] = processed_chunks
                # Removed debug logging to avoid console spam
                # logger.debug(
                #     f"Streamed {len(processed_chunks)} tool call chunk(s): "
                #     f"{[c.get('name') for c in processed_chunks]}"
                # )
            
            yield _make_event("tool_call_chunks", event_stream_message)
        else:
            # AI Message - Raw message tokens
            yield _make_event("message_chunk", event_stream_message)


async def _stream_graph_events(
    graph_instance, workflow_input, workflow_config, thread_id
):
    """Stream events from the graph and process them."""
    try:
        # Removed debug logging to avoid console spam
        # logger.info(f"[DEBUG] Starting graph astream with thread_id: {thread_id}")
        async for agent, _, event_data in graph_instance.astream(
            workflow_input,
            config=workflow_config,
            stream_mode=["messages", "updates"],
            subgraphs=True,
        ):
            if isinstance(event_data, dict):
                if "__interrupt__" in event_data:
                    # Removed debug logging to avoid console spam
                    # logger.info(f"[DEBUG] Graph interrupted, yielding interrupt event")
                    yield _create_interrupt_event(thread_id, event_data)
                    # Removed debug logging to avoid console spam
                    # logger.info(f"[DEBUG] Interrupt event yielded, ending stream")
                    return  # End the stream after interrupt

            # Handle different event_data formats
            if isinstance(event_data, (tuple, list)) and len(event_data) >= 2:
                message_chunk, message_metadata = cast(
                    tuple[BaseMessage, dict[str, Any]], event_data[:2]
                )
            else:
                # Skip non-message events (like AddableUpdatesDict from LangGraph state updates)
                # These are internal state updates and don't need to be streamed to the client
                # Removed debug logging to avoid console spam
                # logger.warning(f"[DEBUG] Unexpected event_data format: {type(event_data)}, content: {event_data}")
                continue

            async for event in _process_message_chunk(
                message_chunk, message_metadata, thread_id, agent
            ):
                yield event
    except Exception as e:
        logger.exception("Error during graph execution")
        yield _make_event(
            "error",
            {
                "thread_id": thread_id,
                "error": "Error during graph execution",
            },
        )


async def _astream_workflow_generator(
    messages: List[dict],
    thread_id: str,
    resources: List[Resource],
    max_plan_iterations: int,
    max_step_num: int,
    max_search_results: int,
    auto_accepted_plan: bool,
    interrupt_feedback: str,
    mcp_settings: dict,
    enable_background_investigation: bool,
    report_style: ReportStyle,
    enable_deep_thinking: bool,
    enable_clarification: bool,
    max_clarification_rounds: int,
    basic_model: Optional[dict] = None,
    reasoning_model: Optional[dict] = None,
    search_engine: Optional[dict] = None,
):
    from src.config.context import set_custom_models, clear_custom_models
    
    # Set custom model configurations in context
    set_custom_models(basic_model, reasoning_model, search_engine)
    
    try:
        # Process initial messages
        for message in messages:
            if isinstance(message, dict) and "content" in message:
                _process_initial_messages(message, thread_id)

        # Prepare workflow input
        # Removed debug logging to avoid console spam
        # logger.info(f"[DEBUG] Checking for existing checkpoint for thread_id: {thread_id}")
        # logger.info(f"[DEBUG] auto_accepted_plan: {auto_accepted_plan}, interrupt_feedback: '{interrupt_feedback}'")
        
        # Check if we have a checkpoint for this thread_id and auto_accepted_plan is False
        # This indicates we're resuming from an interrupt even without explicit interrupt_feedback
        existing_checkpoint = None
        if hasattr(graph, 'checkpointer') and graph.checkpointer:
            try:
                # Try to get the latest checkpoint for this thread
                checkpoint_config = {"configurable": {"thread_id": thread_id}}
                # Removed debug logging to avoid console spam
                # logger.info(f"[DEBUG] Calling graph.checkpointer.get_tuple with config: {checkpoint_config}")
                checkpoint_tuple = graph.checkpointer.get_tuple(checkpoint_config)
                if checkpoint_tuple:
                    existing_checkpoint = checkpoint_tuple
                    # Removed debug logging to avoid console spam
                    # logger.info(f"[DEBUG] Found existing checkpoint for thread_id: {thread_id}")
                    # logger.info(f"[DEBUG] Checkpoint parent config: {checkpoint_tuple[3]}")
                    # logger.info(f"[DEBUG] Checkpoint metadata: {checkpoint_tuple[4]}")
                    pass
                else:
                    # Removed debug logging to avoid console spam
                    # logger.info(f"[DEBUG] No existing checkpoint found for thread_id: {thread_id}")
                    pass
            except Exception as e:
                # If there's no checkpoint, continue with normal flow
                # Removed debug logging to avoid console spam
                # logger.info(f"[DEBUG] Error checking for checkpoint: {e}")
                pass
        else:
            # Removed debug logging to avoid console spam
            # logger.info(f"[DEBUG] No checkpointer found in graph")
            pass

        # Removed debug logging to avoid console spam
        # logger.info(f"[DEBUG] existing_checkpoint: {existing_checkpoint is not None}")
        
        # Fix checkpoint logic: when auto_accepted_plan is False, we should always try to resume from checkpoint
        # This ensures that interrupted workflows can be resumed properly
        if not auto_accepted_plan:
            if existing_checkpoint:
                # Resume from existing checkpoint
                # Removed debug logging to avoid console spam
                # logger.info(f"[DEBUG] Resuming from existing checkpoint for thread_id: {thread_id}")
                resume_msg = f"[{interrupt_feedback}]" if interrupt_feedback else "[RESUME_FROM_INTERRUPT]"
                if messages:
                    resume_msg += f" {messages[-1]['content']}"
                # Removed debug logging to avoid console spam
                # logger.info(f"[DEBUG] Resuming workflow from checkpoint with message: {resume_msg}")
                workflow_input = Command(resume=resume_msg)
            elif interrupt_feedback:
                # New request with interrupt feedback (shouldn't normally happen)
                # Removed debug logging to avoid console spam
                # logger.info(f"[DEBUG] New request with interrupt feedback but no checkpoint: {interrupt_feedback}")
                resume_msg = f"[{interrupt_feedback}]"
                if messages:
                    resume_msg += f" {messages[-1]['content']}"
                workflow_input = Command(resume=resume_msg)
            else:
                # New request without auto_accept_plan, initialize fresh state
                # Removed debug logging to avoid console spam
                # logger.info(f"[DEBUG] Initializing fresh workflow state (no checkpoint found)")
                workflow_input = {
                    "messages": messages,
                    "plan_iterations": 0,
                    "final_report": "",
                    "current_plan": None,
                    "observations": [],
                    "auto_accepted_plan": auto_accepted_plan,
                    "enable_background_investigation": enable_background_investigation,
                    "research_topic": messages[-1]["content"] if messages else "",
                    "enable_clarification": enable_clarification,
                    "max_clarification_rounds": max_clarification_rounds,
                }
        else:
            # For auto-accepted plans, initialize fresh state
            # Removed debug logging to avoid console spam
            # logger.info(f"[DEBUG] Initializing fresh workflow state (auto_accepted_plan=True)")
            workflow_input = {
                "messages": messages,
                "plan_iterations": 0,
                "final_report": "",
                "current_plan": None,
                "observations": [],
                "auto_accepted_plan": auto_accepted_plan,
                "enable_background_investigation": enable_background_investigation,
                "research_topic": messages[-1]["content"] if messages else "",
                "enable_clarification": enable_clarification,
                "max_clarification_rounds": max_clarification_rounds,
            }

        # Prepare workflow config
        workflow_config = {
            "thread_id": thread_id,
            "resources": resources,
            "max_plan_iterations": max_plan_iterations,
            "max_step_num": max_step_num,
            "max_search_results": max_search_results,
            "mcp_settings": mcp_settings,
            "report_style": report_style.value,
            "enable_deep_thinking": enable_deep_thinking,
            "recursion_limit": get_recursion_limit(),
            "search_engine": search_engine,
        }

        checkpoint_saver = get_bool_env("LANGGRAPH_CHECKPOINT_SAVER", False)
        checkpoint_url = get_str_env("LANGGRAPH_CHECKPOINT_DB_URL", "")
        # Handle checkpointer if configured
        connection_kwargs = {
            "autocommit": True,
            "row_factory": "dict_row",
            "prepare_threshold": 0,
        }
        if checkpoint_saver and checkpoint_url != "":
            if checkpoint_url.startswith("postgresql://"):
                logger.info("start async postgres checkpointer.")
                async with AsyncConnectionPool(
                    checkpoint_url, kwargs=connection_kwargs
                ) as conn:
                    checkpointer = AsyncPostgresSaver(conn)
                    await checkpointer.setup()
                    graph.checkpointer = checkpointer
                    graph.store = in_memory_store
                    async for event in _stream_graph_events(
                        graph, workflow_input, workflow_config, thread_id
                    ):
                        yield event
            if checkpoint_url.startswith("mongodb://"):
                logger.info("start async mongodb checkpointer.")
                async with AsyncMongoDBSaver.from_conn_string(
                    checkpoint_url
                ) as checkpointer:
                    graph.checkpointer = checkpointer
                    graph.store = in_memory_store
                    async for event in _stream_graph_events(
                        graph, workflow_input, workflow_config, thread_id
                    ):
                        yield event
        else:
            # Use graph with MemorySaver checkpointer
            # Reuse the checkpointer from the global graph instance to maintain state across requests
            logger.info("Using in-memory checkpointer for interrupts.")
            # Ensure the global graph's checkpointer is used instead of creating a new one
            if not hasattr(graph, 'checkpointer') or graph.checkpointer is None:
                from langgraph.checkpoint.memory import MemorySaver
                graph.checkpointer = MemorySaver()
            graph.store = in_memory_store
            async for event in _stream_graph_events(
                graph, workflow_input, workflow_config, thread_id
            ):
                yield event
    except Exception as e:
        logger.exception(f"Error in workflow generator: {e}")
        raise
    # Note: Don't clear custom models here anymore
    # Each new request will set its own configuration


def _make_event(event_type: str, data: dict[str, any]):
    if data.get("content") == "":
        data.pop("content")
    # Ensure JSON serialization with proper encoding
    try:
        json_data = json.dumps(data, ensure_ascii=False)

        finish_reason = data.get("finish_reason", "")
        chat_stream_message(
            data.get("thread_id", ""),
            f"event: {event_type}\ndata: {json_data}\n\n",
            finish_reason,
        )

        return f"event: {event_type}\ndata: {json_data}\n\n"
    except (TypeError, ValueError) as e:
        logger.error(f"Error serializing event data: {e}")
        # Return a safe error event
        error_data = json.dumps({"error": "Serialization failed"}, ensure_ascii=False)
        return f"event: error\ndata: {error_data}\n\n"


@app.post("/api/podcast/generate")
async def generate_podcast(request: GeneratePodcastRequest):
    """Generate a conversational podcast from given report content."""
    try:
        # Set environment variables for TTS configuration
        if request.siliconflow_api_key:
            os.environ["SILICONFLOW_API_KEY"] = request.siliconflow_api_key
        if request.siliconflow_model:
            os.environ["SILICONFLOW_MODEL"] = request.siliconflow_model
        if request.siliconflow_voice:
            os.environ["SILICONFLOW_VOICE"] = request.siliconflow_voice
        if request.siliconflow_voice2:
            os.environ["SILICONFLOW_VOICE2"] = request.siliconflow_voice2
        
        # Set MiniMax configuration in environment variables
        if request.minimax_api_key:
            os.environ["MINIMAX_API_KEY"] = request.minimax_api_key
        if request.minimax_model:
            os.environ["MINIMAX_MODEL"] = request.minimax_model
        if request.minimax_group_id:
            os.environ["MINIMAX_GROUP_ID"] = request.minimax_group_id
        
        # Set up LLM configuration using context variables
        from src.config.context import set_custom_models
        
        basic_model_config = None
        reasoning_model_config = None
        
        if request.basic_model:
            print(f"Received basic_model config: {request.basic_model}")
            # Convert frontend format to backend format
            basic_model_config = {
                "api_key": request.basic_model.get("apiKey"),
                "base_url": request.basic_model.get("baseUrl"),
                "model": request.basic_model.get("model"),
                "token_limit": request.basic_model.get("tokenLimit", 8000),
            }
            # Remove None values
            basic_model_config = {k: v for k, v in basic_model_config.items() if v is not None}
            print(f"Processed basic_model_config: {basic_model_config}")
        
        if request.reasoning_model:
            reasoning_model_config = {
                "api_key": request.reasoning_model.get("apiKey"),
                "base_url": request.reasoning_model.get("baseUrl"),
                "model": request.reasoning_model.get("model"),
                "token_limit": request.reasoning_model.get("tokenLimit", 8000),
            }
            # Remove None values
            reasoning_model_config = {k: v for k, v in reasoning_model_config.items() if v is not None}
        
        # Set the custom model configurations in context
        set_custom_models(
            basic_model=basic_model_config,
            reasoning_model=reasoning_model_config
        )
        
        # Use the podcast workflow to generate conversational podcast
        from src.podcast.graph.builder import build_graph
        
        workflow = build_graph()
        
        # Prepare initial state with TTS configuration
        initial_state = {
            "input": request.content,
            "siliconflow_api_key": request.siliconflow_api_key,
            "siliconflow_model": request.siliconflow_model,
            "siliconflow_voice": request.siliconflow_voice,
            "minimax_api_key": request.minimax_api_key,
            "minimax_model": request.minimax_model,
            "minimax_group_id": request.minimax_group_id,
        }
        
        # Generate podcast using the workflow
        final_state = workflow.invoke(initial_state)
        
        if "output" not in final_state:
            raise HTTPException(status_code=500, detail="Failed to generate podcast audio")
        
        # Return the generated audio
        return Response(
            content=final_state["output"],
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=podcast.mp3",
                "Content-Type": "audio/mpeg",
                "Cache-Control": "no-cache"
            },
        )

    except HTTPException:
        raise


@app.post("/api/tts")
async def text_to_speech(request: TTSRequest):
    """Convert text to speech using TTS API."""
    try:
        # Handle different TTS models
        if request.model in ["FunAudioLLM/CosyVoice2-0.5B", "fnlp/MOSS-TTSD-v0.5"]:
            # SiliconFlow TTS
            api_key = request.siliconflow_api_key if request.siliconflow_api_key else get_str_env("SILICONFLOW_API_KEY", "")
            if not api_key:
                raise HTTPException(status_code=400, detail="SILICONFLOW_API_KEY is not set")
            
            tts_client = SiliconFlowTTS(
                api_key=api_key,
                model=request.model,
                voice=request.siliconflow_voice,
            )
            
            # Call the TTS API
            result = tts_client.text_to_speech(
                text=request.text[:1024],
                response_format=request.encoding,
                speed=request.siliconflow_speed,
                gain=request.siliconflow_gain,
            )
            
        elif request.siliconflow_api_key:
            # Legacy SiliconFlow TTS support
            # For SiliconFlow, we need to combine the model and voice correctly
            full_voice = f"{request.siliconflow_model}:{request.siliconflow_voice}"
            tts_client = SiliconFlowTTS(
                api_key=request.siliconflow_api_key,
                model=request.siliconflow_model,
                voice=request.siliconflow_voice,
            )
            # Call the TTS API
            result = tts_client.text_to_speech(
                text=request.text[:1024],
                response_format=request.encoding,
                speed=request.siliconflow_speed,
                gain=request.siliconflow_gain,
            )
        
        elif request.model and request.model.startswith("speech-2.6"):
            # Use MiniMax TTS
            api_key = request.minimax_api_key if request.minimax_api_key else get_str_env("MINIMAX_API_KEY", "")
            if not api_key:
                raise HTTPException(
                    status_code=400, 
                    detail="MINIMAX_API_KEY is not set. Please provide it in the TTS settings or set MINIMAX_API_KEY environment variable."
                )
            
            from src.tools.minimax_tts import MinimaxTTS
            
            group_id = request.minimax_group_id if request.minimax_group_id else get_str_env("MINIMAX_GROUP_ID", "")
            
            tts_client = MinimaxTTS(
                api_key=api_key,
                model=request.model,
                group_id=group_id if group_id else None,
            )
            
            # Call the MiniMax TTS API
            result = tts_client.text_to_speech(
                text=request.text[:1024],
                voice_id=request.minimax_voice_id if request.minimax_voice_id else "male-qn-qingse",
                speed=request.minimax_speed if request.minimax_speed else 1.0,
                vol=request.minimax_vol if request.minimax_vol else 1.0,
                pitch=request.minimax_pitch if request.minimax_pitch else 0,
                audio_format=request.encoding if request.encoding else "mp3",
            )
        else:
            # No valid TTS configuration found
            raise HTTPException(
                status_code=400, 
                detail="No valid TTS configuration found. Please configure SiliconFlow, MiniMax, or other TTS service."
            )

        if not result["success"]:
            raise HTTPException(status_code=500, detail=str(result["error"]))

        # Handle audio data based on TTS provider
        if request.siliconflow_api_key or (request.model and request.model.startswith("speech-2.6")):
            # SiliconFlow and MiniMax return raw audio data
            audio_data = result["audio_data"]
        # No need for else case since we removed Volcengine

        # Return the audio file
        return Response(
            content=audio_data,
            media_type=f"audio/{request.encoding}",
            headers={
                "Content-Disposition": (
                    f"attachment; filename=tts_output.{request.encoding}"
                )
            },
        )

    except Exception as e:
        logger.exception(f"Error in TTS endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=INTERNAL_SERVER_ERROR_DETAIL)




@app.post("/api/ppt/generate")
async def generate_ppt(request: GeneratePPTRequest):
    try:
        report_content = request.content
        print(report_content)
        workflow = build_ppt_graph()
        final_state = workflow.invoke({"input": report_content})
        generated_file_path = final_state["generated_file_path"]
        with open(generated_file_path, "rb") as f:
            ppt_bytes = f.read()
        return Response(
            content=ppt_bytes,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
    except Exception as e:
        logger.exception(f"Error occurred during ppt generation: {str(e)}")
        raise HTTPException(status_code=500, detail=INTERNAL_SERVER_ERROR_DETAIL)


@app.post("/api/prose/generate")
async def generate_prose(request: GenerateProseRequest):
    try:
        sanitized_prompt = request.prompt.replace("\r\n", "").replace("\n", "")
        logger.info(f"Generating prose for prompt: {sanitized_prompt}")
        workflow = build_prose_graph()
        events = workflow.astream(
            {
                "content": request.prompt,
                "option": request.option,
                "command": request.command,
            },
            stream_mode="messages",
            subgraphs=True,
        )
        return StreamingResponse(
            (f"data: {event[0].content}\n\n" async for _, event in events),
            media_type="text/event-stream",
        )
    except Exception as e:
        logger.exception(f"Error occurred during prose generation: {str(e)}")
        raise HTTPException(status_code=500, detail=INTERNAL_SERVER_ERROR_DETAIL)


@app.post("/api/prompt/enhance")
async def enhance_prompt(request: EnhancePromptRequest):
    try:
        from src.config.context import set_custom_models, clear_custom_models
        
        # Set custom model configurations in context
        set_custom_models(request.basic_model, request.reasoning_model, request.search_engine)
        
        try:
            sanitized_prompt = request.prompt.replace("\r\n", "").replace("\n", "")
            logger.info(f"Enhancing prompt: {sanitized_prompt}")

            # Convert string report_style to ReportStyle enum
            report_style = None
            if request.report_style:
                try:
                    # Handle both uppercase and lowercase input
                    style_mapping = {
                        "ACADEMIC": ReportStyle.ACADEMIC,
                        "POPULAR_SCIENCE": ReportStyle.POPULAR_SCIENCE,
                        "NEWS": ReportStyle.NEWS,
                        "SOCIAL_MEDIA": ReportStyle.SOCIAL_MEDIA,
                        "STRATEGIC_INVESTMENT": ReportStyle.STRATEGIC_INVESTMENT,
                    }
                    report_style = style_mapping.get(
                        request.report_style.upper(), ReportStyle.ACADEMIC
                    )
                except Exception:
                    # If invalid style, default to ACADEMIC
                    report_style = ReportStyle.ACADEMIC
            else:
                report_style = ReportStyle.ACADEMIC

            workflow = build_prompt_enhancer_graph()
            final_state = workflow.invoke(
                {
                    "prompt": request.prompt,
                    "context": request.context,
                    "report_style": report_style,
                }
            )
            return {"result": final_state["output"]}
        finally:
            # Clear custom model configurations
            clear_custom_models()
    except Exception as e:
        logger.exception(f"Error occurred during prompt enhancement: {str(e)}")
        raise HTTPException(status_code=500, detail=INTERNAL_SERVER_ERROR_DETAIL)


@app.post("/api/mcp/server/metadata", response_model=MCPServerMetadataResponse)
async def mcp_server_metadata(request: MCPServerMetadataRequest):
    """Get information about an MCP server."""
    # Check if MCP server configuration is enabled
    if not get_bool_env("ENABLE_MCP_SERVER_CONFIGURATION", False):
        raise HTTPException(
            status_code=403,
            detail="MCP server configuration is disabled. Set ENABLE_MCP_SERVER_CONFIGURATION=true to enable MCP features.",
        )

    try:
        # Set default timeout with a longer value for this endpoint
        timeout = 300  # Default to 300 seconds for this endpoint

        # Use custom timeout from request if provided
        if request.timeout_seconds is not None:
            timeout = request.timeout_seconds

        # Load tools from the MCP server using the utility function
        tools = await load_mcp_tools(
            server_type=request.transport,
            command=request.command,
            args=request.args,
            url=request.url,
            env=request.env,
            headers=request.headers,
            timeout_seconds=timeout,
        )

        # Create the response with tools
        response = MCPServerMetadataResponse(
            transport=request.transport,
            command=request.command,
            args=request.args,
            url=request.url,
            env=request.env,
            headers=request.headers,
            tools=tools,
        )

        return response
    except Exception as e:
        logger.exception(f"Error in MCP server metadata endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=INTERNAL_SERVER_ERROR_DETAIL)


@app.get("/api/rag/config", response_model=RAGConfigResponse)
async def rag_config():
    """Get the config of the RAG."""
    return RAGConfigResponse(provider=SELECTED_RAG_PROVIDER)


@app.get("/api/rag/resources", response_model=RAGResourcesResponse)
async def rag_resources(request: Annotated[RAGResourceRequest, Query()]):
    """Get the resources of the RAG."""
    retriever = build_retriever()
    if retriever:
        return RAGResourcesResponse(resources=retriever.list_resources(request.query))
    return RAGResourcesResponse(resources=[])


@app.get("/api/config", response_model=ConfigResponse)
async def config():
    """Get the config of the server."""
    return ConfigResponse(
        rag=RAGConfigResponse(provider=SELECTED_RAG_PROVIDER),
        models=get_configured_llm_models(),
    )


@app.get("/api/reporters")
async def get_latest_reporters():
    """Get latest generated reporters for homepage display."""
    try:
        # Read reports from local reports directory
        reports_dir = Path("reports")
        
        if not reports_dir.exists():
            logger.info("Reports directory does not exist")
            return {"reporters": []}
        
        # Find all markdown files in reports directory
        report_files = glob.glob("reports/*.md")
        reporters = []
        
        for report_file in sorted(report_files, key=os.path.getmtime, reverse=True):
            try:
                with open(report_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Extract title (first # heading) and description (first paragraph)
                lines = content.split('\n')
                title = "未命名报告"
                description = ""
                
                for line in lines:
                    line = line.strip()
                    if line.startswith('# ') and title == "未命名报告":
                        title = line[2:].strip()
                    elif line and not line.startswith('#') and description == "":
                        # Get first non-empty, non-heading line as description
                        description = line[:200] + "..." if len(line) > 200 else line
                        break
                
                # Generate ID from filename
                report_id = Path(report_file).stem
                
                # Get creation time
                creation_time = os.path.getmtime(report_file)
                import datetime
                created_at = datetime.datetime.fromtimestamp(creation_time).isoformat() + "Z"
                
                reporters.append({
                    "id": report_id,
                    "title": title,
                    "description": description,
                    "createdAt": created_at
                })
                
            except Exception as e:
                logger.warning(f"Error processing report file {report_file}: {str(e)}")
                continue
        
        logger.info(f"Found {len(reporters)} reports in local directory")
        return {"reporters": reporters}
        
    except Exception as e:
        logger.exception(f"Error fetching reporters: {str(e)}")
        return {"reporters": []}


@app.get("/api/reporters/{report_id}")
async def get_reporter_detail(report_id: str):
    """Get detailed information about a specific report."""
    try:
        # Read report from local reports directory
        report_file = Path(f"reports/{report_id}.md")
        
        if not report_file.exists():
            raise HTTPException(status_code=404, detail="Report not found")
        
        with open(report_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract title (first # heading) and description (first paragraph)
        lines = content.split('\n')
        title = "未命名报告"
        description = ""
        
        for line in lines:
            line = line.strip()
            if line.startswith('# ') and title == "未命名报告":
                title = line[2:].strip()
            elif line and not line.startswith('#') and description == "":
                # Get first non-empty, non-heading line as description
                description = line[:200] + "..." if len(line) > 200 else line
                break
        
        # Get creation and modification times
        creation_time = os.path.getmtime(report_file)
        modification_time = os.path.getmtime(report_file)
        import datetime
        created_at = datetime.datetime.fromtimestamp(creation_time).isoformat() + "Z"
        updated_at = datetime.datetime.fromtimestamp(modification_time).isoformat() + "Z"
        
        # TODO: Extract sources and images from content in the future
        # For now, return empty arrays
        metadata = {
            "style": "research",
            "sources": [],
            "images": []
        }
        
        return {
            "id": report_id,
            "title": title,
            "description": description,
            "content": content,
            "createdAt": created_at,
            "updatedAt": updated_at,
            "metadata": metadata
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching reporter detail: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch report")


@app.get("/api/settings")
async def get_settings():
    """Get user settings configuration."""
    # Return default settings without persistent storage
    return {
        "config": {
            "general": {
                "language": "zh",
                "theme": "light", 
                "autoAcceptPlan": False,
                "enableClarification": True,
                "maxClarificationRounds": 3,
                "maxPlanIterations": 2,
                "maxStepsOfPlan": 3,
                "maxSearchResults": 3,
            },
            "mcp": {
                "servers": []
            },
            "reportStyle": {
                "writingStyle": "popularScience"
            }
        }
    }


@app.post("/api/settings")
async def save_settings(settings_data: dict):
    """Save user settings configuration."""
    try:
        # Just log the settings without persistent storage
        # User will configure settings each time they use the system
        logger.info(f"User settings received: {settings_data}")
        
        return {"success": True, "config": settings_data}
    except Exception as e:
        logger.exception(f"Error saving settings: {str(e)}")
        return {"success": False, "error": "Failed to save settings"}


@app.get("/api/report/{report_id}")
async def get_report_content(report_id: str):
    """Get the full content of a specific report for replay."""
    try:
        # Construct file path
        report_file = Path("reports") / f"{report_id}.md"
        
        # Check if file exists
        if not report_file.exists():
            raise HTTPException(status_code=404, detail=f"Report with id '{report_id}' not found")
        
        # Read file content
        with open(report_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Return the content as plain text/markdown
        return Response(
            content=content,
            media_type="text/markdown"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error reading report {report_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to read report")
