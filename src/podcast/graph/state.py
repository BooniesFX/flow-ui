# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

from typing import Optional

from langgraph.graph import MessagesState

from ..types import Script


class PodcastState(MessagesState):
    """State for the podcast generation."""

    # Input
    input: str = ""

    # Output
    output: Optional[bytes] = None

    # Assets
    script: Optional[Script] = None
    audio_chunks: list[bytes] = []

    # TTS Configuration
    siliconflow_api_key: Optional[str] = None
    siliconflow_model: Optional[str] = None
    siliconflow_voice: Optional[str] = None
    minimax_api_key: Optional[str] = None
    minimax_model: Optional[str] = None
    minimax_group_id: Optional[str] = None
