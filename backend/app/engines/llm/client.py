import httpx
from app.core.config import settings

class LLMClient:
    def __init__(self, base_url=settings.OLLAMA_BASE_URL, model=settings.OLLAMA_MODEL):
        self.base_url = base_url
        self.model = model

    async def generate(self, prompt: str, model: str | None = None):
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={"model": model or self.model, "prompt": prompt, "stream": False},
                    timeout=30.0
                )
                response.raise_for_status()
                return response.json().get("response", "")
            except Exception as e:
                print(f"LLM Error: {e}")
                return "I'm sorry, I couldn't process that."

    async def chat(self, messages: list[dict[str, str]], options: dict | None = None,
                   model: str | None = None) -> str:
        """One /api/chat call. The model stays loaded for OLLAMA_KEEP_ALIVE between questions."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": model or self.model,
                        "messages": messages,
                        "stream": False,
                        "keep_alive": settings.OLLAMA_KEEP_ALIVE,
                        "options": options or {},
                    },
                    timeout=settings.LLM_TIMEOUT_SECONDS,
                )
                response.raise_for_status()
                return response.json().get("message", {}).get("content", "").strip()
            except Exception as e:
                print(f"LLM Error: {e}")
                return "Sorry, I can't answer right now. Is Ollama running?"

llm_client = LLMClient()
