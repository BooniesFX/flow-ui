# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

"""
Text-to-Speech module using SiliconFlow TTS API.
"""

import json
import logging
import uuid
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)


class SiliconFlowTTS:
    """
    Client for SiliconFlow Text-to-Speech API.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "FunAudioLLM/CosyVoice2-0.5B",
        voice: str = "alex",
        host: str = "api.siliconflow.cn",
    ):
        """
        Initialize the SiliconFlow TTS client.

        Args:
            api_key: API key for authentication
            model: TTS model to use (e.g., FunAudioLLM/CosyVoice2-0.5B, fnlp/MOSS-TTSD-v0.5)
            voice: Voice type to use (model-specific voice identifier)
            host: API host
        """
        self.api_key = api_key
        self.model = model
        self.voice = voice
        self.host = host
        self.api_url = f"https://{host}/v1/audio/speech"
        self.header = {"Authorization": f"Bearer {api_key}"}

    def text_to_speech(
        self,
        text: str,
        response_format: str = "mp3",
        speed: float = 1.0,
        gain: float = 0.0,
        stream: bool = False,
    ) -> Dict[str, Any]:
        """
        Convert text to speech using SiliconFlow TTS API.

        Args:
            text: Text to convert to speech
            response_format: Audio format (mp3, opus, wav, pcm)
            speed: Speech speed (0.25-4.0)
            gain: Audio gain in dB (-10 to 10)
            stream: Whether to stream the response

        Returns:
            Dictionary containing the API response or error information
        """
        # For SiliconFlow, we need to combine the model and voice correctly
        full_voice = f"{self.model}:{self.voice}"
        
        request_json = {
            "model": self.model,
            "input": text,
            "voice": full_voice,
            "response_format": response_format,
            "speed": speed,
            "gain": gain,
            "stream": stream,
        }

        try:
            sanitized_text = text.replace("\r\n", "").replace("\n", "")
            logger.debug(f"Sending TTS request for text: {sanitized_text[:50]}...")
            response = requests.post(
                self.api_url, json=request_json, headers=self.header
            )

            if response.status_code != 200:
                logger.error(f"TTS API error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "error": f"TTS API error: {response.status_code} - {response.text}",
                    "audio_data": None,
                }

            # For successful requests, return the raw audio content
            return {
                "success": True,
                "response": response,
                "audio_data": response.content,  # Raw audio data
            }

        except Exception as e:
            logger.exception(f"Error in TTS API call: {str(e)}")
            # Provide more specific error information
            if "timeout" in str(e).lower():
                error_msg = "TTS API timeout - the request took too long to process"
            elif "connection" in str(e).lower():
                error_msg = "TTS API connection error - unable to reach the service"
            elif "auth" in str(e).lower() or "unauthorized" in str(e).lower():
                error_msg = "TTS API authentication error - invalid API key or credentials"
            elif "rate" in str(e).lower() and "limit" in str(e).lower():
                error_msg = "TTS API rate limit exceeded - please try again later"
            else:
                error_msg = f"TTS API error: {str(e)}"

            return {"success": False, "error": error_msg, "audio_data": None}
