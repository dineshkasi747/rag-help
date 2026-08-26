"""
LLM provider abstraction layer.

Design rationale:
- Abstract base class + factory pattern allows dropping in any LLM.
- All providers expose a unified `complete()` and `stream()` interface.
- Includes automatic multi-model fallback across supported models and providers.
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
# Google Gemini
# ---------------------------------------------------------------------------

class GeminiLLM(BaseLLM):
    FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-pro"]

    def __init__(self, model: str = "gemini-2.5-flash", api_key: str | None = None):
        self._model = model
        self._api_key = api_key or os.getenv("GEMINI_API_KEY", "")

    async def complete(self, messages: list[dict]) -> str:
        import google.generativeai as genai
        genai.configure(api_key=self._api_key)
        prompt = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages)
        
        models_to_try = [self._model] + [m for m in self.FALLBACK_MODELS if m != self._model]
        last_err = None
        for m in models_to_try:
            try:
                model = genai.GenerativeModel(m)
                resp = await model.generate_content_async(prompt)
                if resp.text:
                    return resp.text
            except Exception as e:
                last_err = e
                logger.warning("Gemini model %s failed: %s", m, e)
        raise last_err or Exception("All Gemini models failed")

    async def stream(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        import google.generativeai as genai
        genai.configure(api_key=self._api_key)
        prompt = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages)
        
        model = genai.GenerativeModel(self._model)
        async for chunk in await model.generate_content_async(prompt, stream=True):
            if chunk.text:
                yield chunk.text


# ---------------------------------------------------------------------------
# Groq
# ---------------------------------------------------------------------------

class GroqLLM(BaseLLM):
    FALLBACK_MODELS = [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
        "groq/compound",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant"
    ]

    def __init__(self, model: str = "openai/gpt-oss-120b", api_key: str | None = None):
        self._model = model
        self._api_key = api_key or os.getenv("GROQ_API_KEY", "")

    async def complete(self, messages: list[dict]) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self._api_key, base_url="https://api.groq.com/openai/v1")
        
        models_to_try = [self._model] + [m for m in self.FALLBACK_MODELS if m != self._model]
        last_err = None
        for m in models_to_try:
            try:
                resp = await client.chat.completions.create(model=m, messages=messages)
                content = resp.choices[0].message.content or ""
                if content:
                    return content
            except Exception as e:
                last_err = e
                logger.warning("Groq model %s error: %s, trying next model...", m, e)
                
        # If Groq completely fails and Gemini key is available, fallback to Gemini
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            try:
                logger.info("Falling back to Gemini LLM from Groq...")
                gemini_llm = GeminiLLM(api_key=gemini_key)
                return await gemini_llm.complete(messages)
            except Exception as gem_e:
                logger.warning("Fallback to Gemini also failed: %s", gem_e)

        raise last_err or Exception("All Groq models failed")

    async def stream(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self._api_key, base_url="https://api.groq.com/openai/v1")
        
        models_to_try = [self._model] + [m for m in self.FALLBACK_MODELS if m != self._model]
        stream_started = False
        
        for m in models_to_try:
            try:
                response = await client.chat.completions.create(model=m, messages=messages, stream=True)
                async for chunk in response:
                    if hasattr(chunk, 'choices') and len(chunk.choices) > 0:
                        delta = chunk.choices[0].delta.content
                        if delta:
                            stream_started = True
                            yield delta
                if stream_started:
                    return
            except Exception as e:
                if stream_started:
                    raise
                logger.warning("Groq stream model %s error: %s, trying next model...", m, e)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_llm() -> BaseLLM:
    provider = os.getenv("LLM_PROVIDER", "groq").lower()
    if provider == "gemini":
        model = os.getenv("LLM_MODEL", "gemini-2.5-flash")
        logger.info("Using Gemini LLM: %s", model)
        return GeminiLLM(model=model)
    else:
        # Default to Groq with openai/gpt-oss-120b
        model = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
        if model == "llama-3.3-70b-versatile":
            model = "openai/gpt-oss-120b"
        logger.info("Using Groq LLM: %s", model)
        return GroqLLM(model=model)
