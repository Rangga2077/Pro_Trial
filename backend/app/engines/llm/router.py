from app.engines.llm.client import llm_client

class LLMRouter:
    async def route_query(self, query: str):
        # Simple keyword-based routing for now
        if "substitute" in query.lower() or "replace" in query.lower():
            # Complex query -> External API (simulated)
            return await self._handle_external(query)
        else:
            # Simple query -> Local LLM
            return await llm_client.generate(query)

    async def _handle_external(self, query: str):
        # Placeholder for Gemini/OpenAI call
        return f"[External API] Suggestion for: {query}"

llm_router = LLMRouter()
