# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

import asyncio
import json
from typing import Any, Dict, List, Optional

import aiohttp
import requests
from langchain_tavily._utilities import TAVILY_API_URL
from langchain_tavily.tavily_search import (
    TavilySearchAPIWrapper as OriginalTavilySearchAPIWrapper,
)

from src.config import load_yaml_config
from src.tools.search_postprocessor import SearchResultPostProcessor


def get_search_config():
    config = load_yaml_config("conf.yaml")
    search_config = config.get("SEARCH_ENGINE", {})
    return search_config


class EnhancedTavilySearchAPIWrapper(OriginalTavilySearchAPIWrapper):
    def __init__(self, api_key: Optional[str] = None, postprocessor_params: Optional[Dict] = None, **kwargs):
        # Always call parent __init__ to ensure proper pydantic initialization
        # If we have a custom API key, temporarily store it and set tavily_api_key
        if api_key:
            # Create a temporary tavily_api_key to satisfy parent initialization
            temp_kwargs = kwargs.copy()
            temp_kwargs['tavily_api_key'] = api_key  # Pass as plain string
            super().__init__(**temp_kwargs)
            self._custom_api_key = api_key
        else:
            # Call parent __init__ which will handle tavily_api_key from environment
            super().__init__(**kwargs)
            self._custom_api_key = None
        # Store postprocessor_params as a private attribute to avoid Pydantic validation
        object.__setattr__(self, '_postprocessor_params', postprocessor_params)
    
    def _get_api_key(self) -> str:
        """Get API key from custom key or fall back to environment."""
        if self._custom_api_key:
            return self._custom_api_key
        # Fall back to parent's tavily_api_key
        if hasattr(self, 'tavily_api_key'):
            return self.tavily_api_key.get_secret_value()
        raise ValueError("No API key available")
    
    def raw_results(
        self,
        query: str,
        max_results: Optional[int] = 5,
        search_depth: Optional[str] = "advanced",
        include_domains: Optional[List[str]] = [],
        exclude_domains: Optional[List[str]] = [],
        include_answer: Optional[bool] = False,
        include_raw_content: Optional[bool] = False,
        include_images: Optional[bool] = False,
        include_image_descriptions: Optional[bool] = False,
    ) -> Dict:
        params = {
            "api_key": self._get_api_key(),
            "query": query,
            "max_results": max_results,
            "search_depth": search_depth,
            "include_domains": include_domains,
            "exclude_domains": exclude_domains,
            "include_answer": include_answer,
            "include_raw_content": include_raw_content,
            "include_images": include_images,
            "include_image_descriptions": include_image_descriptions,
        }
        response = requests.post(
            # type: ignore
            f"{TAVILY_API_URL}/search",
            json=params,
        )
        response.raise_for_status()
        return response.json()

    async def raw_results_async(
        self,
        query: str,
        max_results: Optional[int] = 5,
        search_depth: Optional[str] = "advanced",
        include_domains: Optional[List[str]] = [],
        exclude_domains: Optional[List[str]] = [],
        include_answer: Optional[bool] = False,
        include_raw_content: Optional[bool] = False,
        include_images: Optional[bool] = False,
        include_image_descriptions: Optional[bool] = False,
    ) -> Dict:
        """Get results from the Tavily Search API asynchronously."""

        # Function to perform the API call
        async def fetch() -> str:
            params = {
                "api_key": self._get_api_key(),
                "query": query,
                "max_results": max_results,
                "search_depth": search_depth,
                "include_domains": include_domains,
                "exclude_domains": exclude_domains,
                "include_answer": include_answer,
                "include_raw_content": include_raw_content,
                "include_images": include_images,
                "include_image_descriptions": include_image_descriptions,
            }

            # Add timeout and retry logic
            timeout = aiohttp.ClientTimeout(total=30, connect=10)
            max_retries = 3
            base_delay = 1

            for attempt in range(max_retries):
                try:
                    async with aiohttp.ClientSession(
                        trust_env=True,
                        timeout=timeout,
                        connector=aiohttp.TCPConnector(limit=10, force_close=True)
                    ) as session:
                        async with session.post(f"{TAVILY_API_URL}/search", json=params) as res:
                            if res.status == 200:
                                data = await res.text()
                                return data
                            elif res.status == 429:
                                # Rate limited - wait longer
                                delay = base_delay * (2 ** attempt) * 2
                                if attempt < max_retries - 1:
                                    await asyncio.sleep(delay)
                                    continue
                                else:
                                    raise Exception(f"Rate limit exceeded after {max_retries} attempts")
                            elif res.status >= 500:
                                # Server error - retry
                                if attempt < max_retries - 1:
                                    await asyncio.sleep(base_delay * (2 ** attempt))
                                    continue
                                else:
                                    raise Exception(f"Server error {res.status}: {res.reason}")
                            else:
                                # Client error - don't retry
                                error_text = await res.text()
                                raise Exception(f"API error {res.status}: {res.reason} - {error_text[:200]}")

                except aiohttp.ClientError as e:
                    if attempt < max_retries - 1:
                        await asyncio.sleep(base_delay * (2 ** attempt))
                        continue
                    else:
                        raise Exception(f"Connection error after {max_retries} attempts: {str(e)}")
                except asyncio.TimeoutError as e:
                    if attempt < max_retries - 1:
                        await asyncio.sleep(base_delay * (2 ** attempt))
                        continue
                    else:
                        raise Exception(f"Request timeout after {max_retries} attempts")

            raise Exception("Failed to complete search request")

        results_json_str = await fetch()
        try:
            return json.loads(results_json_str)
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON response from search API: {str(e)}")

    def clean_results_with_images(
        self, raw_results: Dict[str, List[Dict]]
    ) -> List[Dict]:
        results = raw_results["results"]
        """Clean results from Tavily Search API."""
        clean_results = []
        for result in results:
            clean_result = {
                "type": "page",
                "title": result["title"],
                "url": result["url"],
                "content": result["content"],
                "score": result["score"],
            }
            if raw_content := result.get("raw_content"):
                clean_result["raw_content"] = raw_content
            clean_results.append(clean_result)
        images = raw_results["images"]
        for image in images:
            clean_result = {
                "type": "image_url",
                "image_url": {"url": image["url"]},
                "image_description": image["description"],
            }
            clean_results.append(clean_result)

        # Use postprocessor_params if available, otherwise fall back to global config
        if hasattr(self, '_postprocessor_params') and self._postprocessor_params:
            min_score_threshold = self._postprocessor_params.get("min_score_threshold")
            max_content_length_per_page = self._postprocessor_params.get("max_content_length_per_page")
        else:
            search_config = get_search_config()
            min_score_threshold = search_config.get("min_score_threshold")
            max_content_length_per_page = search_config.get("max_content_length_per_page")
        
        clean_results = SearchResultPostProcessor(
            min_score_threshold=min_score_threshold,
            max_content_length_per_page=max_content_length_per_page,
        ).process_results(clean_results)

        return clean_results
