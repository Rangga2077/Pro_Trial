from app.engines.llm.client import llm_client

# Queries asking for a substitution get a focused prompt. Everything stays on
# the local LLM; nothing here may call an external service.
SUBSTITUTION_KEYWORDS = ("substitute", "replace")


class LLMRouter:
    async def route_query(self, query: str) -> str:
        if any(keyword in query.lower() for keyword in SUBSTITUTION_KEYWORDS):
            return await llm_client.generate(self._substitution_prompt(query))
        return await llm_client.generate(query)

    @staticmethod
    def _substitution_prompt(query: str) -> str:
        return (
            "You are a cooking assistant. Suggest one to three practical ingredient substitutions "
            "with amounts, in under 60 words.\n"
            f"Question: {query}"
        )


llm_router = LLMRouter()
