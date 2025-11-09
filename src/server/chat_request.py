# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

from typing import List, Optional, Union

from pydantic import BaseModel, Field

from src.config.report_style import ReportStyle
from src.rag.retriever import Resource


class ContentItem(BaseModel):
    type: str = Field(..., description="The type of content (text, image, etc.)")
    text: Optional[str] = Field(None, description="The text content if type is 'text'")
    image_url: Optional[str] = Field(
        None, description="The image URL if type is 'image'"
    )


class ChatMessage(BaseModel):
    role: str = Field(
        ..., description="The role of the message sender (user or assistant)"
    )
    content: Union[str, List[ContentItem]] = Field(
        ...,
        description="The content of the message, either a string or a list of content items",
    )


class ChatRequest(BaseModel):
    messages: Optional[List[ChatMessage]] = Field(
        [], description="History of messages between the user and the assistant"
    )
    resources: Optional[List[Resource]] = Field(
        [], description="Resources to be used for the research"
    )
    debug: Optional[bool] = Field(False, description="Whether to enable debug logging")
    thread_id: Optional[str] = Field(
        "__default__", description="A specific conversation identifier"
    )
    max_plan_iterations: Optional[int] = Field(
        1, description="The maximum number of plan iterations"
    )
    max_step_num: Optional[int] = Field(
        3, description="The maximum number of steps in a plan"
    )
    max_search_results: Optional[int] = Field(
        3, description="The maximum number of search results"
    )
    auto_accepted_plan: Optional[bool] = Field(
        False, description="Whether to automatically accept the plan"
    )
    interrupt_feedback: Optional[str] = Field(
        None, description="Interrupt feedback from the user on the plan"
    )
    mcp_settings: Optional[dict] = Field(
        None, description="MCP settings for the chat request"
    )
    enable_background_investigation: Optional[bool] = Field(
        True, description="Whether to get background investigation before plan"
    )
    report_style: Optional[ReportStyle] = Field(
        ReportStyle.ACADEMIC, description="The style of the report"
    )
    enable_deep_thinking: Optional[bool] = Field(
        False, description="Whether to enable deep thinking"
    )
    enable_clarification: Optional[bool] = Field(
        None,
        description="Whether to enable multi-turn clarification (default: None, uses State default=False)",
    )
    max_clarification_rounds: Optional[int] = Field(
        None,
        description="Maximum number of clarification rounds (default: None, uses State default=3)",
    )
    # Model settings
    basic_model: Optional[dict] = Field(
        None, description="Basic model configuration (baseUrl, model, apiKey)"
    )
    reasoning_model: Optional[dict] = Field(
        None, description="Reasoning model configuration (baseUrl, model, apiKey)"
    )
    # Search engine settings
    search_engine: Optional[dict] = Field(
        None, description="Search engine configuration (engine, apiKey, includeImages, minScoreThreshold)"
    )


class TTSRequest(BaseModel):
    text: str = Field(..., description="The text to convert to speech")
    model: Optional[str] = Field("FunAudioLLM/CosyVoice2-0.5B", description="The TTS model to use")
    voice_type: Optional[str] = Field(
        "alloy", description="The voice type to use"
    )
    encoding: Optional[str] = Field("mp3", description="The audio encoding format")
    speed_ratio: Optional[float] = Field(1.0, description="Speech speed ratio")
    volume_ratio: Optional[float] = Field(1.0, description="Speech volume ratio")
    pitch_ratio: Optional[float] = Field(1.0, description="Speech pitch ratio")
    text_type: Optional[str] = Field("plain", description="Text type (plain or ssml)")
    with_frontend: Optional[int] = Field(
        1, description="Whether to use frontend processing"
    )
    frontend_type: Optional[str] = Field("unitTson", description="Frontend type")
    siliconflow_api_key: Optional[str] = Field(None, description="API key for SiliconFlow TTS service")
    siliconflow_model: Optional[str] = Field("FunAudioLLM/CosyVoice2-0.5B", description="SiliconFlow TTS model to use")
    siliconflow_voice: Optional[str] = Field("alex", description="SiliconFlow voice to use")
    siliconflow_speed: Optional[float] = Field(1.0, description="SiliconFlow speech speed (0.25-4.0)")
    siliconflow_gain: Optional[float] = Field(0.0, description="SiliconFlow audio gain in dB (-10 to 10)")
    minimax_api_key: Optional[str] = Field(None, description="API key for MiniMax TTS service")
    minimax_group_id: Optional[str] = Field(None, description="Group ID for MiniMax TTS service")
    minimax_voice_id: Optional[str] = Field(None, description="MiniMax voice ID")
    minimax_voice_id2: Optional[str] = Field(None, description="MiniMax second voice ID for dialogue")
    minimax_speed: Optional[float] = Field(1.0, description="MiniMax speech speed (0.5-2.0)")
    minimax_vol: Optional[float] = Field(1.0, description="MiniMax volume (0.5-1.5)")
    minimax_pitch: Optional[int] = Field(0, description="MiniMax pitch (-20 to 20)")


class GeneratePodcastRequest(BaseModel):
    content: str = Field(..., description="The content of the podcast")
    model: Optional[str] = Field("FunAudioLLM/CosyVoice2-0.5B", description="The TTS model to use")
    voice_type: Optional[str] = Field(
        "alloy", description="The voice type to use"
    )
    speed_ratio: Optional[float] = Field(1.0, description="Speech speed ratio")
    volume_ratio: Optional[float] = Field(1.0, description="Speech volume ratio")
    pitch_ratio: Optional[float] = Field(1.0, description="Speech pitch ratio")
    api_key: Optional[str] = Field(None, description="API key for TTS service")
    endpoint: Optional[str] = Field(None, description="Endpoint URL for TTS service")
    siliconflow_api_key: Optional[str] = Field(None, description="API key for SiliconFlow TTS service")
    siliconflow_model: Optional[str] = Field("FunAudioLLM/CosyVoice2-0.5B", description="SiliconFlow TTS model to use")
    siliconflow_voice: Optional[str] = Field("alex", description="SiliconFlow voice to use")
    siliconflow_voice2: Optional[str] = Field("anna", description="Second SiliconFlow voice for dialogue")
    siliconflow_speed: Optional[float] = Field(1.0, description="SiliconFlow speech speed (0.25-4.0)")
    siliconflow_gain: Optional[float] = Field(0.0, description="SiliconFlow audio gain in dB (-10 to 10)")
    minimax_api_key: Optional[str] = Field(None, description="API key for MiniMax TTS service")
    minimax_model: Optional[str] = Field("speech-2.6-hd", description="MiniMax TTS model to use")
    minimax_group_id: Optional[str] = Field(None, description="Group ID for MiniMax TTS service")
    minimax_voice: Optional[str] = Field("male-qn-qingse", description="Voice ID for MiniMax TTS")
    minimax_voice2: Optional[str] = Field("female-shaonv", description="Second voice ID for MiniMax TTS")
    minimax_speed: Optional[float] = Field(1.0, description="MiniMax speech speed (0.5-2.0)")
    minimax_vol: Optional[float] = Field(1.0, description="MiniMax volume (0.5-1.5)")
    minimax_pitch: Optional[int] = Field(0, description="MiniMax pitch (-20 to 20)")
    basic_model: Optional[dict] = Field(None, description="Basic model configuration for script generation")
    reasoning_model: Optional[dict] = Field(None, description="Reasoning model configuration for script generation")


class GeneratePPTRequest(BaseModel):
    content: str = Field(..., description="The content of the ppt")


class GenerateProseRequest(BaseModel):
    prompt: str = Field(..., description="The content of the prose")
    option: str = Field(..., description="The option of the prose writer")
    command: Optional[str] = Field(
        "", description="The user custom command of the prose writer"
    )


class EnhancePromptRequest(BaseModel):
    prompt: str = Field(..., description="The original prompt to enhance")
    context: Optional[str] = Field(
        "", description="Additional context about the intended use"
    )
    report_style: Optional[str] = Field(
        "academic", description="The style of the report"
    )
    # Model settings
    basic_model: Optional[dict] = Field(
        None, description="Basic model configuration (baseUrl, model, apiKey)"
    )
    reasoning_model: Optional[dict] = Field(
        None, description="Reasoning model configuration (baseUrl, model, apiKey)"
    )
    # Search engine settings
    search_engine: Optional[dict] = Field(
        None, description="Search engine configuration (engine, apiKey, includeImages, minScoreThreshold)"
    )
