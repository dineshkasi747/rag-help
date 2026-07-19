"""
LLM provider abstraction layer.

Design rationale:
- Abstract base class + factory pattern allows dropping in any LLM.
- All providers expose a unified `complete()` and `stream()` interface.
- System prompt + conversation history is managed by the caller (RAGPipeline).
- Streaming: yields text delta strings for SSE transport.
"""

from __future__ import annotations
import logging
import os
from abc import ABC, abstractmethod
from typing import AsyncGenerator

logger = logging.getLogger(__name__)


class BaseLLM(ABC):
    @abstractmethod
    async def complete(self, messages: list[dict]) -> str:
        """Single-turn completion. Returns full response string."""
        ...

    @abstractmethod
    async def stream(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        """Streaming completion. Yields text deltas."""
        ...


# ---------------------------------------------------------------------------
# Anthropic Claude
# ---------------------------------------------------------------------------

class AnthropicLLM(BaseLLM):
    def __init__(self, model: str = "claude-3-5-haiku-latest", api_key: str | None = None):
        self._model = model
        self._api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")

    async def complete(self, messages: list[dict]) -> str:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=self._api_key)
        # Extract system from messages
        system = next((m["content"] for m in messages if m["role"] == "system"), "")
        user_msgs = [m for m in messages if m["role"] != "system"]
        resp = await client.messages.create(
            model=self._model, max_tokens=2048, system=system, messages=user_msgs
        )
        return resp.content[0].text

    async def stream(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=self._api_key)
        system = next((m["content"] for m in messages if m["role"] == "system"), "")
        user_msgs = [m for m in messages if m["role"] != "system"]
        async with client.messages.stream(
            model=self._model, max_tokens=2048, system=system, messages=user_msgs
        ) as s:
            async for text in s.text_stream:
                yield text


# ---------------------------------------------------------------------------
# Google Gemini
# ---------------------------------------------------------------------------

class GeminiLLM(BaseLLM):
    def __init__(self, model: str = "gemini-2.0-flash", api_key: str | None = None):
        self._model = model
        self._api_key = api_key or os.getenv("GEMINI_API_KEY", "")

    async def complete(self, messages: list[dict]) -> str:
        import google.generativeai as genai
        genai.configure(api_key=self._api_key)
        model = genai.GenerativeModel(self._model)
        prompt = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages)
        resp = await model.generate_content_async(prompt)
        return resp.text

    async def stream(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        import google.generativeai as genai
        genai.configure(api_key=self._api_key)
        model = genai.GenerativeModel(self._model)
        prompt = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages)
        async for chunk in await model.generate_content_async(prompt, stream=True):
            if chunk.text:
                yield chunk.text


# ---------------------------------------------------------------------------
# Groq
# ---------------------------------------------------------------------------

class GroqLLM(BaseLLM):
    def __init__(self, model: str = "llama-3.3-70b-versatile", api_key: str | None = None):
        self._model = model
        self._api_key = api_key or os.getenv("GROQ_API_KEY", "")

    async def complete(self, messages: list[dict]) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self._api_key, base_url="https://api.groq.com/openai/v1")
        resp = await client.chat.completions.create(model=self._model, messages=messages)
        return resp.choices[0].message.content or ""

    async def stream(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self._api_key, base_url="https://api.groq.com/openai/v1")
        response = await client.chat.completions.create(model=self._model, messages=messages, stream=True)
        async for chunk in response:
            if hasattr(chunk, 'choices') and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_llm() -> BaseLLM:
    provider = os.getenv("LLM_PROVIDER", "groq").lower()
    if provider == "anthropic":
        model = os.getenv("LLM_MODEL", "claude-3-5-haiku-latest")
        logger.info("Using Anthropic LLM: %s", model)
        return AnthropicLLM(model=model)
    elif provider == "gemini":
        model = os.getenv("LLM_MODEL", "gemini-2.0-flash")
        logger.info("Using Gemini LLM: %s", model)
        return GeminiLLM(model=model)
    else:
        model = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
        logger.info("Using Groq LLM: %s", model)
        return GroqLLM(model=model)
