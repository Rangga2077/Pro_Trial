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

llm_client = LLMClient()
