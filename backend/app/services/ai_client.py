import asyncio
import json
import os
from typing import Any, Dict

import aiohttp
from fastapi import HTTPException

DEFAULT_AI_BASE_URL = "http://localhost:8001"
DEFAULT_TIMEOUT_SECONDS = 5.0
DEFAULT_ANALYZE_PATH = "/api/v1/analyze"


def _get_ai_base_url() -> str:
    base = os.getenv("AI_SERVER_BASE_URL", DEFAULT_AI_BASE_URL).strip()
    if not base:
        base = DEFAULT_AI_BASE_URL
    return base.rstrip("/")


def _get_ai_timeout() -> float:
    raw = os.getenv("AI_SERVER_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS)).strip()
    try:
        timeout = float(raw)
    except ValueError:
        timeout = DEFAULT_TIMEOUT_SECONDS
    return max(0.1, timeout)


def _get_analyze_endpoint() -> str:
    path = os.getenv("AI_SERVER_ANALYZE_PATH", DEFAULT_ANALYZE_PATH).strip() or DEFAULT_ANALYZE_PATH
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{_get_ai_base_url()}{path}"


async def fetch_ai_analysis(full_url: str) -> Dict[str, Any]:
    endpoint = _get_analyze_endpoint()
    timeout = aiohttp.ClientTimeout(total=_get_ai_timeout())

    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(endpoint, json={"url": full_url}) as resp:
                text = await resp.text()
                if resp.status >= 400:
                    raise HTTPException(
                        status_code=502,
                        detail={"error": "ai_server_error", "status": resp.status},
                    )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="ai_server_timeout")
    except aiohttp.ClientError:
        raise HTTPException(status_code=502, detail="ai_server_unreachable")

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="ai_server_invalid_response")

    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="ai_server_invalid_response")

    data.pop("score", None)
    return data
