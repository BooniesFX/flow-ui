# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

import logging
from typing import Annotated

from langchain_core.tools import tool

from src.crawler import Crawler

from .decorators import log_io

logger = logging.getLogger(__name__)


@tool
@log_io
def crawl_tool(
    url: Annotated[str, "The url to crawl."],
) -> str:
    """Use this to crawl a url and get a readable content in markdown format."""
    try:
        crawler = Crawler()
        article = crawler.crawl(url)
        content = article.to_markdown()[:1000]
        return {"url": url, "crawled_content": content}
    except ConnectionError as e:
        error_msg = f"Connection failed while crawling {url}. The website may be down or blocking requests."
        logger.error(f"Connection error for {url}: {repr(e)}")
        return error_msg
    except TimeoutError as e:
        error_msg = f"Timeout while crawling {url}. The website took too long to respond."
        logger.error(f"Timeout error for {url}: {repr(e)}")
        return error_msg
    except Exception as e:
        # Check for common error patterns
        error_str = str(e).lower()
        if "upstream connect error" in error_str:
            error_msg = f"Network connectivity issue while crawling {url}. Please try again later."
        elif "disconnect/reset" in error_str:
            error_msg = f"Connection was reset while crawling {url}. The server may be overloaded."
        elif "ssl" in error_str or "certificate" in error_str:
            error_msg = f"SSL certificate issue while crawling {url}. The website may have security problems."
        elif "blocked" in error_str or "forbidden" in error_str:
            error_msg = f"Access blocked while crawling {url}. The website may be blocking automated requests."
        else:
            error_msg = f"Failed to crawl {url}. Error: {repr(e)}"

        logger.error(f"Crawl error for {url}: {error_msg}")
        return error_msg
