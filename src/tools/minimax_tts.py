# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

"""
Text-to-Speech module using MiniMax TTS API.
"""

import json
import logging
import uuid
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)


class MinimaxTTS:
    """
    Client for MiniMax Text-to-Speech API.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "speech-2.6-hd",
        host: str = "api-bj.minimaxi.com",
        group_id: Optional[str] = None,
    ):
        """
        Initialize the MiniMax TTS client.

        Args:
            api_key: API key for authentication
            model: TTS model to use (speech-2.6-hd, speech-2.6-turbo, etc.)
            host: API host
            group_id: Group ID for authentication (optional for some endpoints)
        """
        self.api_key = api_key
        self.model = model
        self.host = host
        self.group_id = group_id
        self.api_url = f"https://{host}/v1/t2a_v2"
        self.header = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    def text_to_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: Optional[float] = None,
        vol: Optional[float] = None,
        pitch: Optional[int] = None,
        audio_format: str = "mp3",
        stream: bool = False,
        subtitle: bool = False,
        output_format: str = "hex",
        rhythm: bool = False,
    ) -> Dict[str, Any]:
        """
        Convert text to speech using MiniMax TTS API.

        Args:
            text: Text to convert to speech (max 10000 characters)
            voice_id: Voice ID (optional)
            speed: Speech speed (optional)
            vol: Volume (optional)
            pitch: Pitch (optional)
            audio_format: Audio format (mp3, wav, flac)
            stream: Whether to use streaming output
            subtitle: Whether to enable subtitle service
            output_format: Output format (url, hex)
            rhythm: Whether to add rhythm marker

        Returns:
            Dictionary containing success status and audio data or error
        """
        try:
            # Prepare request payload
            payload = {
                "model": self.model,
                "text": text,
                "stream": stream,
                "subtitle": subtitle,
                "output_format": output_format,
                "rhythm": rhythm,
            }
            
            # Add group_id if available
            if self.group_id:
                payload["group_id"] = self.group_id

            # Add voice_setting object (required by MiniMax API)
            voice_setting = {}
            if voice_id:
                voice_setting["voice_id"] = voice_id
            if speed is not None:
                voice_setting["speed"] = speed
            if vol is not None:
                voice_setting["vol"] = vol
            if pitch is not None:
                voice_setting["pitch"] = pitch
            
            if voice_setting:
                payload["voice_setting"] = voice_setting

            # Add audio_setting object
            audio_setting = {
                "sample_rate": 32000,
                "bitrate": 128000,
                "format": audio_format if audio_format else "mp3",
                "channel": 1
            }
            payload["audio_setting"] = audio_setting

            logger.info(f"Sending MiniMax TTS request: {json.dumps(payload, indent=2)}")

            # Send request to MiniMax API
            response = requests.post(
                self.api_url,
                headers=self.header,
                json=payload,
                timeout=60
            )

            logger.info(f"MiniMax TTS response status: {response.status_code}")

            if response.status_code == 200:
                response_data = response.json()
                logger.info(f"MiniMax TTS response: {json.dumps(response_data, indent=2)}")

                if response_data.get("base_resp") and response_data["base_resp"].get("status_code") == 0:
                    # Success - extract audio data
                    if "data" in response_data:
                        data_field = response_data["data"]
                        
                        # Check if data is a dictionary (actual MiniMax API response structure)
                        if isinstance(data_field, dict):
                            # MiniMax API returns a dict with audio data
                            if "audio" in data_field:
                                audio_hex = data_field["audio"]
                            elif "hex" in data_field:
                                audio_hex = data_field["hex"]
                            else:
                                # Try to find any hex string in the dict
                                audio_hex = None
                                for key, value in data_field.items():
                                    if isinstance(value, str) and value and len(value) > 10 and all(c in "0123456789abcdefABCDEF" for c in value):
                                        audio_hex = value
                                        break
                                
                                if not audio_hex:
                                    return {
                                        "success": False,
                                        "error": f"Could not find audio data in response: {data_field}"
                                    }
                        else:
                            # Direct hex string (unlikely based on error)
                            audio_hex = data_field
                        
                        # Convert hex to bytes
                        try:
                            audio_data = bytes.fromhex(audio_hex)
                            return {
                                "success": True,
                                "audio_data": audio_data
                            }
                        except (ValueError, TypeError) as e:
                            return {
                                "success": False,
                                "error": f"Failed to convert hex to bytes: {str(e)}"
                            }
                    else:
                        return {
                            "success": False,
                            "error": "No audio data in response"
                        }
                else:
                    # API returned error
                    error_msg = response_data.get("base_resp", {}).get("status_msg", "Unknown API error")
                    logger.error(f"MiniMax TTS API error: {response_data}")
                    return {
                        "success": False,
                        "error": error_msg
                    }
            else:
                # HTTP error
                error_msg = f"HTTP {response.status_code}: {response.text}"
                logger.error(f"MiniMax TTS HTTP error: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg
                }

        except requests.exceptions.RequestException as e:
            logger.error(f"MiniMax TTS request exception: {e}")
            return {
                "success": False,
                "error": f"Request failed: {str(e)}"
            }
        except Exception as e:
            logger.error(f"MiniMax TTS unexpected error: {e}")
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }