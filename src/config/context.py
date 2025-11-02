# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

from typing import Optional, Dict, Any
from contextvars import ContextVar

# Context variables for storing custom configurations
_custom_basic_model: ContextVar[Optional[Dict[str, Any]]] = ContextVar("custom_basic_model", default=None)
_custom_reasoning_model: ContextVar[Optional[Dict[str, Any]]] = ContextVar("custom_reasoning_model", default=None)
_custom_search_engine: ContextVar[Optional[Dict[str, Any]]] = ContextVar("custom_search_engine", default=None)

def set_custom_models(
    basic_model: Optional[Dict[str, Any]] = None,
    reasoning_model: Optional[Dict[str, Any]] = None,
    search_engine: Optional[Dict[str, Any]] = None,
):
    """Set custom model configurations for the current context."""
    # Clear LLM cache when setting new configurations
    from src.llms.llm import _llm_cache
    _llm_cache.clear()
    
    if basic_model is not None:
        _custom_basic_model.set(basic_model)
    if reasoning_model is not None:
        _custom_reasoning_model.set(reasoning_model)
    if search_engine is not None:
        _custom_search_engine.set(search_engine)

def get_custom_basic_model() -> Optional[Dict[str, Any]]:
    """Get custom basic model configuration."""
    return _custom_basic_model.get()

def get_custom_reasoning_model() -> Optional[Dict[str, Any]]:
    """Get custom reasoning model configuration."""
    return _custom_reasoning_model.get()

def get_custom_search_engine() -> Optional[Dict[str, Any]]:
    """Get custom search engine configuration."""
    return _custom_search_engine.get()

def clear_custom_models():
    """Clear custom model configurations."""
    _custom_basic_model.set(None)
    _custom_reasoning_model.set(None)
    _custom_search_engine.set(None)