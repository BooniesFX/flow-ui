# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

import base64
import logging
import os

from src.podcast.graph.state import PodcastState
from src.tools.tts import VolcengineTTS
from src.tools.siliconflow_tts import SiliconFlowTTS

logger = logging.getLogger(__name__)


def tts_node(state: PodcastState):
    logger.info("Generating audio chunks for podcast...")
    tts_client = _create_tts_client()
    
    # Check if we're using SiliconFlow TTS
    use_siliconflow = isinstance(tts_client, SiliconFlowTTS)
    
    # Get voice settings from environment variables
    siliconflow_voice = os.getenv("SILICONFLOW_VOICE", "alex")
    siliconflow_voice2 = os.getenv("SILICONFLOW_VOICE2", "anna")
    
    for line in state["script"].lines:
        if use_siliconflow:
            # For SiliconFlow, set voice based on speaker
            if hasattr(tts_client, 'voice'):
                # Use configured voices for male/female speakers
                tts_client.voice = (
                    siliconflow_voice if line.speaker == "male" 
                    else siliconflow_voice2
                )
            result = tts_client.text_to_speech(line.paragraph, speed=1.05)
        else:
            # For Volcengine, set voice based on speaker
            tts_client.voice_type = (
                "BV002_streaming" if line.speaker == "male" else "BV001_streaming"
            )
            result = tts_client.text_to_speech(line.paragraph, speed_ratio=1.05)
            
        if result["success"]:
            if use_siliconflow:
                # SiliconFlow returns raw audio data
                audio_chunk = result["audio_data"]
            else:
                # Volcengine returns base64 encoded audio data
                audio_data = result["audio_data"]
                audio_chunk = base64.b64decode(audio_data)
            state["audio_chunks"].append(audio_chunk)
        else:
            logger.error(result["error"])
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
    else:
        # Use Volcengine TTS as default
        app_id = os.getenv("VOLCENGINE_TTS_APPID", "")
        if not app_id:
            raise Exception("VOLCENGINE_TTS_APPID is not set")
        access_token = os.getenv("VOLCENGINE_TTS_ACCESS_TOKEN", "")
        if not access_token:
            raise Exception("VOLCENGINE_TTS_ACCESS_TOKEN is not set")
        cluster = os.getenv("VOLCENGINE_TTS_CLUSTER", "volcano_tts")
        voice_type = "BV001_streaming"
        return VolcengineTTS(
            appid=app_id,
            access_token=access_token,
            cluster=cluster,
            voice_type=voice_type,
        )
