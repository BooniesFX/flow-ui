# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

"""
Text-to-Speech module using system native TTS.
Cross-platform support for Windows (SAPI) and macOS (NSSpeechSynthesizer).
"""

import logging
import os
import platform
import subprocess
import tempfile
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class SystemTTS:
    """
    Cross-platform system TTS client using native OS capabilities.
    """

    def __init__(self, voice: Optional[str] = None, speed: float = 1.0):
        """
        Initialize the system TTS client.

        Args:
            voice: Voice name (platform-specific)
            speed: Speech speed ratio
        """
        self.voice = voice
        self.speed = speed
        self.platform = platform.system().lower()
        
        if self.platform == "windows":
            self._init_windows()
        elif self.platform == "darwin":
            self._init_macos()
        else:
            logger.warning(f"Unsupported platform: {self.platform}")
            raise Exception(f"Platform {self.platform} is not supported")

    def _init_windows(self):
        """Initialize Windows SAPI."""
        try:
            import win32com.client
            self.speaker = win32com.client.Dispatch("SAPI.SpVoice")
            if self.voice:
                self.speaker.Voice = self._get_voice_by_name(self.voice)
            self.speaker.Rate = int((self.speed - 1.0) * 10)  # Convert to SAPI rate (-10 to 10)
        except ImportError:
            raise Exception("Windows TTS requires pywin32. Install with: pip install pywin32")
        except Exception as e:
            raise Exception(f"Failed to initialize Windows TTS: {str(e)}")

    def _init_macos(self):
        """Initialize macOS NSSpeechSynthesizer."""
        # macOS will use osascript commands
        pass

    def _get_voice_by_name(self, voice_name: str):
        """Get Windows voice object by name."""
        try:
            import win32com.client
            speaker = win32com.client.Dispatch("SAPI.SpVoice")
            for voice in speaker.GetVoices():
                if voice_name.lower() in voice.GetDescription().lower():
                    return voice
            return None
        except Exception as e:
            logger.error(f"Error getting voice by name: {str(e)}")
            return None

    def text_to_speech(self, text: str, **kwargs) -> Dict[str, Any]:
        """
        Convert text to speech using system TTS.

        Args:
            text: Text to convert to speech
            **kwargs: Additional parameters (ignored for system TTS)

        Returns:
            Dictionary containing the audio data or error information
        """
        try:
            if self.platform == "windows":
                return self._windows_tts(text)
            elif self.platform == "darwin":
                return self._macos_tts(text)
            else:
                return {"success": False, "error": f"Unsupported platform: {self.platform}", "audio_data": None}
        except Exception as e:
            logger.exception(f"Error in system TTS: {str(e)}")
            return {"success": False, "error": str(e), "audio_data": None}

    def _windows_tts(self, text: str) -> Dict[str, Any]:
        """Generate speech using Windows SAPI."""
        try:
            import win32com.client
            
            # Create temporary file for audio
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_path = temp_file.name
            
            try:
                # Use SAPI to generate speech
                speaker = win32com.client.Dispatch("SAPI.SpVoice")
                if self.voice:
                    voice_obj = self._get_voice_by_name(self.voice)
                    if voice_obj:
                        speaker.Voice = voice_obj
                
                speaker.Rate = int((self.speed - 1.0) * 10)
                
                # Save to file
                file_stream = win32com.client.Dispatch("SAPI.SpFileStream")
                file_stream.Format.Type = 22  # Standard WAV format
                file_stream.Open(temp_path, 3)  # SSFMCreateForWrite
                speaker.AudioOutputStream = file_stream
                
                speaker.Speak(text)
                file_stream.Close()
                
                # Always try to convert to MP3 for browser compatibility
                mp3_path = temp_path.replace(".aiff", ".mp3")
                try:
                    # Try using afconvert (built into macOS) first
                    subprocess.run(["afconvert", "-f", "MPG4", "-d", "LEI32", "-q", "127", temp_path, mp3_path], 
                                 check=True, capture_output=True)
                    with open(mp3_path, "rb") as f:
                        audio_data = f.read()
                    os.unlink(mp3_path)
                except (subprocess.CalledProcessError, FileNotFoundError) as e:
                    logger.warning(f"afconvert conversion failed: {str(e)}")
                    # Try ffmpeg as fallback
                    try:
                        subprocess.run(["ffmpeg", "-i", temp_path, "-codec:a", "mp3", "-b:a", "128k", mp3_path], 
                                     check=True, capture_output=True)
                        with open(mp3_path, "rb") as f:
                            audio_data = f.read()
                        os.unlink(mp3_path)
                    except (subprocess.CalledProcessError, FileNotFoundError) as e2:
                        logger.warning(f"FFmpeg conversion also failed: {str(e2)}")
                        # Last resort: try converting to M4A using afconvert (more compatible than AIFF)
                        m4a_path = temp_path.replace(".aiff", ".m4a")
                        try:
                            subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", temp_path, m4a_path], 
                                         check=True, capture_output=True)
                            with open(m4a_path, "rb") as f:
                                audio_data = f.read()
                            os.unlink(m4a_path)
                            return {"success": True, "audio_data": audio_data, "format": "m4a"}
                        except (subprocess.CalledProcessError, FileNotFoundError):
                            # Ultimate fallback: return AIFF data but with proper MIME type
                            logger.warning("Could not convert to any browser-compatible format, returning AIFF format")
                            with open(temp_path, "rb") as f:
                                audio_data = f.read()
                            return {"success": True, "audio_data": audio_data, "format": "aiff"}
                
                return {"success": True, "audio_data": audio_data, "format": format_type}
                
            finally:
                # Clean up temp file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                    
        except Exception as e:
            logger.exception(f"Windows TTS error: {str(e)}")
            return {"success": False, "error": f"Windows TTS error: {str(e)}", "audio_data": None}

    def _macos_tts(self, text: str) -> Dict[str, Any]:
        """Generate speech using macOS say command."""
        try:
            # Create temporary file for audio
            with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as temp_file:
                temp_path = temp_file.name
            
            try:
                # Build say command to output directly to M4A format
                cmd = ["say", "-v", self.voice if self.voice else "Alex", "-r", str(int(self.speed * 200)), 
                       "--file-format=M4AF", "-o", temp_path, text]
                
                # Execute say command
                result = subprocess.run(cmd, capture_output=True)
                
                if result.returncode != 0:
                    error_msg = result.stderr.decode('utf-8').strip() if result.stderr else "Unknown error"
                    return {"success": False, "error": f"macOS TTS error: {error_msg}", "audio_data": None}
                
                # Read the generated audio file
                with open(temp_path, "rb") as f:
                    audio_data = f.read()
                
                if not audio_data:
                    return {"success": False, "error": "No audio data generated", "audio_data": None}
                
                return {"success": True, "audio_data": audio_data, "format": "m4a"}
                
            finally:
                # Clean up temp file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                    
        except Exception as e:
            logger.exception(f"macOS TTS error: {str(e)}")
            return {"success": False, "error": f"macOS TTS error: {str(e)}", "audio_data": None}

    def get_available_voices(self) -> list:
        """Get list of available voices for the current platform."""
        voices = []
        
        if self.platform == "windows":
            try:
                import win32com.client
                speaker = win32com.client.Dispatch("SAPI.SpVoice")
                for voice in speaker.GetVoices():
                    voices.append(voice.GetDescription())
            except Exception as e:
                logger.error(f"Error getting Windows voices: {str(e)}")
                
        elif self.platform == "darwin":
            try:
                result = subprocess.run(["say", "-v", "?"], capture_output=True, text=True)
                if result.returncode == 0:
                    for line in result.stdout.strip().split('\n'):
                        if line.strip():
                            voices.append(line.strip().split()[0])
            except Exception as e:
                logger.error(f"Error getting macOS voices: {str(e)}")
        
        return voices