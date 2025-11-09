# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

import base64
import logging
import os
import time

from src.podcast.graph.state import PodcastState
from src.tools.siliconflow_tts import SiliconFlowTTS
from src.tools.minimax_tts import MinimaxTTS

logger = logging.getLogger(__name__)

# Track last request time for rate limiting
last_tts_request_time = 0
MIN_REQUEST_INTERVAL = 6  # 6 seconds interval for 10 RPM (with some buffer)


def _rate_limit_delay():
    """Add delay to respect rate limits."""
    global last_tts_request_time
    current_time = time.time()
    time_since_last_request = current_time - last_tts_request_time
    
    if time_since_last_request < MIN_REQUEST_INTERVAL:
        sleep_time = MIN_REQUEST_INTERVAL - time_since_last_request
        logger.debug(f"Rate limiting: sleeping for {sleep_time:.2f}s")
        time.sleep(sleep_time)
    
    last_tts_request_time = time.time()


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
            if use_minimax:
                # Add rate limiting delay for MiniMax
                _rate_limit_delay()
            
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
                result = _call_minimax_with_retry(tts_client, line.paragraph, voice_id=voice_id, speed=1.05)
                if result["success"]:
                    audio_chunk = result["audio_data"]  # MiniMax TTS already returns bytes
                    state["audio_chunks"].append(audio_chunk)
                else:
                    logger.error(result["error"])
                    continue
                
                # For bilingual mode, generate Chinese audio
                if is_bilingual and line.paragraph_zh:
                    result_zh = _call_minimax_with_retry(tts_client, line.paragraph_zh, voice_id=voice_id, speed=1.05)
                    if result_zh["success"]:
                        audio_chunk_zh = result_zh["audio_data"]  # MiniMax TTS already returns bytes
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


def _call_minimax_with_retry(tts_client, text, **kwargs):
    """Call MiniMax TTS with retry logic for rate limiting."""
    max_retries = 3
    base_delay = 5  # seconds
    
    # Ensure audio_format is set to mp3 if not already specified
    if 'audio_format' not in kwargs:
        kwargs['audio_format'] = 'mp3'
    
    for attempt in range(max_retries):
        try:
            result = tts_client.text_to_speech(text, **kwargs)
            
            if not result["success"]:
                error_msg = str(result.get("error", ""))
                if "rate limit" in error_msg.lower() or "1002" in error_msg:
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)  # Exponential backoff
                        logger.warning(f"Rate limit hit, waiting {delay}s before retry {attempt + 1}/{max_retries}")
                        time.sleep(delay)
                        continue
                    else:
                        logger.error(f"Max retries reached for rate limit: {error_msg}")
                        return result
                else:
                    # Not a rate limit error
                    return result
            else:
                # Success
                return result
        except Exception as e:
            if "rate limit" in str(e).lower():
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"Rate limit exception, waiting {delay}s before retry {attempt + 1}/{max_retries}")
                    time.sleep(delay)
                    continue
                else:
                    logger.error(f"Max retries reached for rate limit exception: {e}")
                    return {"success": False, "error": str(e)}
            else:
                # Other exception
                return {"success": False, "error": str(e)}
    
    return {"success": False, "error": "Max retries exceeded"}


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
