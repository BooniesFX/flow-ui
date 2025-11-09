# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

import logging

from src.podcast.graph.state import PodcastState

logger = logging.getLogger(__name__)


def audio_mixer_node(state: PodcastState):
    logger.info("Mixing audio chunks for podcast...")
    audio_chunks = state["audio_chunks"]
    
    # Check if we have any audio chunks
    if not audio_chunks:
        logger.error("No audio chunks to mix")
        raise Exception("No audio chunks to mix")
    
    # Simply concatenate all audio chunks
    # This assumes all chunks are in the same format
    combined_audio = b"".join(audio_chunks)
    
    # Log some information about the combined audio
    logger.info(f"Combined audio size: {len(combined_audio)} bytes")
    
    # Check if the audio data starts with MP3 header (0xFFE)
    if len(combined_audio) >= 2:
        header = int.from_bytes(combined_audio[:2], byteorder='big')
        if (header & 0xFFE0) == 0xFFE0:
            logger.info("Audio data appears to start with valid MP3 frame header")
        else:
            logger.warning("Audio data may not start with valid MP3 frame header")
    
    logger.info("The podcast audio is now ready.")
    return {"output": combined_audio}
