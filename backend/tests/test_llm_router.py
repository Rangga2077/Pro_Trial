import asyncio

from app.engines.llm import router as router_module
from app.engines.llm.router import LLMRouter


def run_queries(monkeypatch, *queries: str) -> tuple[list[str], list[str]]:
    """Routes each query through a fake local LLM; returns (prompts sent, responses)."""
    prompts: list[str] = []

    async def fake_generate(prompt: str, model: str | None = None) -> str:
        prompts.append(prompt)
        return f"local answer {len(prompts)}"

    monkeypatch.setattr(router_module.llm_client, "generate", fake_generate)
    router = LLMRouter()

    async def run():
        return [await router.route_query(query) for query in queries]

    return prompts, asyncio.run(run())


def test_substitution_query_gets_the_substitution_prompt(monkeypatch):
    prompts, responses = run_queries(
        monkeypatch,
        "What can I substitute for soy sauce?",
        "Can I REPLACE peanuts?",
    )

    for prompt, query in zip(prompts, ["What can I substitute for soy sauce?", "Can I REPLACE peanuts?"]):
        assert prompt.startswith("You are a cooking assistant. Suggest one to three practical ingredient substitutions")
        assert prompt.endswith(f"\nQuestion: {query}")
    assert responses == ["local answer 1", "local answer 2"]


def test_other_queries_are_passed_through(monkeypatch):
    prompts, responses = run_queries(monkeypatch, "How long do I boil an egg?")

    assert prompts == ["How long do I boil an egg?"]
    assert responses == ["local answer 1"]


def test_router_never_returns_external_api_text(monkeypatch):
    _, responses = run_queries(monkeypatch, "What can I substitute for tofu?", "Hello")

    assert all("[External API]" not in response for response in responses)
    assert not hasattr(LLMRouter, "_handle_external")
