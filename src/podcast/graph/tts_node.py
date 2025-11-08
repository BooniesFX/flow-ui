# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

import base64
import logging
import os

from src.podcast.graph.state import PodcastState
from src.tools.siliconflow_tts import SiliconFlowTTS
from src.tools.minimax_tts import MinimaxTTS

logger = logging.getLogger(__name__)


def tts_node(state: PodcastState):
    logger.info("Generating audio chunks for podcast...")
    tts_client = _create_tts_client()
    
    # Check which TTS service we're using
    use_siliconflow = isinstance(tts_client, SiliconFlowTTS)
    use_minimax = isinstance(tts_client, MinimaxTTS)
    
    # Get voice settings from environment variables
    siliconflow_voice = os.getenv("SILICONFLOW_VOICE", "alex")
    siliconflow_voice2 = os.getenv("SILICONFLOW_VOICE2", "anna")
    minimax_voice = os.getenv("MINIMAX_VOICE", "male-qn-qingse")
    minimax_voice2 = os.getenv("MINIMAX_VOICE2", "female-shaonv")
    
    try:
        is_bilingual = state["script"].locale == "bilingual"
        
        for line in state["script"].lines:
            if use_siliconflow:
                # For SiliconFlow, set voice based on speaker
                if hasattr(tts_client, 'voice'):
                    # Use configured voices for male/female speakers
                    tts_client.voice = (
                        siliconflow_voice if line.speaker == "male" 
                        else siliconflow_voice2
                    )
                
                # Generate audio for primary language
                result = tts_client.text_to_speech(line.paragraph, speed=1.05)
                if result["success"]:
                    audio_chunk = result["audio_data"]
                    state["audio_chunks"].append(audio_chunk)
                else:
                    logger.error(result["error"])
                    continue
                
                # For bilingual mode, generate Chinese audio
                if is_bilingual and line.paragraph_zh:
                    result_zh = tts_client.text_to_speech(line.paragraph_zh, speed=1.05)
                    if result_zh["success"]:
                        audio_chunk_zh = result_zh["audio_data"]
                        state["audio_chunks"].append(audio_chunk_zh)
                    else:
                        logger.error(f"Chinese TTS failed: {result_zh['error']}")
                        
            elif use_minimax:
                # For MiniMax TTS, set voice based on speaker
                voice_id = (
                    minimax_voice if line.speaker == "male" 
                    else minimax_voice2
                )
                
                # Generate audio for primary language
                result = tts_client.text_to_speech(line.paragraph, voice_id=voice_id, speed=1.05)
                if result["success"]:
                    audio_data = result["audio_data"]
                    audio_chunk = base64.b64decode(audio_data)
                    state["audio_chunks"].append(audio_chunk)
                else:
                    logger.error(result["error"])
                    continue
                
                # For bilingual mode, generate Chinese audio
                if is_bilingual and line.paragraph_zh:
                    result_zh = tts_client.text_to_speech(line.paragraph_zh, voice_id=voice_id, speed=1.05)
                    if result_zh["success"]:
                        audio_data_zh = result_zh["audio_data"]
                        audio_chunk_zh = base64.b64decode(audio_data_zh)
                        state["audio_chunks"].append(audio_chunk_zh)
                    else:
                        logger.error(f"Chinese TTS failed: {result_zh['error']}")
            else:
                # Default fallback
                logger.error("No valid TTS client found")
                raise Exception("No valid TTS configuration found")
            
    except Exception as e:
        logger.error(f"Error in TTS generation: {e}")
        raise e
    
    return {
        "audio_chunks": state["audio_chunks"],
    }


def _create_tts_client():
    # Check if SiliconFlow configuration is available
    siliconflow_api_key = os.getenv("SILICONFLOW_API_KEY", "")
    if siliconflow_api_key:
        # Use SiliconFlow TTS
        model = os.getenv("SILICONFLOW_MODEL", "FunAudioLLM/CosyVoice2-0.5B")
        voice = os.getenv("SILICONFLOW_VOICE", "alex")
        return SiliconFlowTTS(
            api_key=siliconflow_api_key,
            model=model,
            voice=voice,
        )
    
    # Check if MiniMax configuration is available
    minimax_api_key = os.getenv("MINIMAX_API_KEY", "")
    if minimax_api_key:
        # Use MiniMax TTS
        model = os.getenv("MINIMAX_MODEL", "speech-2.6-hd")
        return MinimaxTTS(
            api_key=minimax_api_key,
            model=model,
        )
    
    # No valid TTS configuration found
    raise Exception("No TTS configuration found. Please set either SILICONFLOW_API_KEY or MINIMAX_API_KEY")
