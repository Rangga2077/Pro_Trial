import httpx

class LLMClient:
    def __init__(self, base_url="http://localhost:11434"):
        self.base_url = base_url

    async def generate(self, prompt: str, model="llama3.2"):
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={"model": model, "prompt": prompt, "stream": False},
                    timeout=30.0
                )
                response.raise_for_status()
                return response.json().get("response", "")
            except Exception as e:
                print(f"LLM Error: {e}")
                return "I'm sorry, I couldn't process that."

llm_client = LLMClient()
