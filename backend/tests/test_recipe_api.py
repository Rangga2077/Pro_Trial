import shutil
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints import recipes as recipes_endpoint
from app.services.recipe_loader import RecipeLoader


TMP_ROOT = Path(__file__).resolve().parent / "_tmp_recipes"


def make_client(name: str, monkeypatch):
    recipes_dir = TMP_ROOT / name
    shutil.rmtree(recipes_dir, ignore_errors=True)

    loader = RecipeLoader(recipes_dir)
    monkeypatch.setattr(recipes_endpoint, "recipe_loader", loader)

    app = FastAPI()
    app.include_router(recipes_endpoint.router, prefix="/api/v1/recipes")
    return TestClient(app), loader, recipes_dir


def test_recipe_api_lists_and_gets_existing_recipe(monkeypatch):
    client, loader, recipes_dir = make_client("list_get", monkeypatch)
    try:
        recipe = loader.create_recipe(
            recipes_endpoint.RecipeCreate(
                title="Smoke Test Noodles",
                ingredients=[{"name": "Noodles", "amount": 1, "unit": "pack"}],
                instructions=[{"step": 1, "description": "Boil noodles."}],
            )
        )

        list_response = client.get("/api/v1/recipes/")
        assert list_response.status_code == 200
        assert list_response.json()[0]["id"] == recipe.id

        get_response = client.get(f"/api/v1/recipes/{recipe.id}")
        assert get_response.status_code == 200
        assert get_response.json()["title"] == "Smoke Test Noodles"
    finally:
        shutil.rmtree(recipes_dir, ignore_errors=True)


def test_recipe_api_creates_and_deletes_recipe(monkeypatch):
    client, _loader, recipes_dir = make_client("create_delete", monkeypatch)
    try:
        create_response = client.post(
            "/api/v1/recipes/",
            json={
                "title": "Temporary Soup",
                "ingredients": [{"name": "Water", "amount": 1, "unit": "cup"}],
                "instructions": [{"step": 1, "description": "Warm the water."}],
            },
        )
        assert create_response.status_code == 200
        recipe_id = create_response.json()["id"]

        delete_response = client.delete(f"/api/v1/recipes/{recipe_id}")
        assert delete_response.status_code == 200

        missing_response = client.get(f"/api/v1/recipes/{recipe_id}")
        assert missing_response.status_code == 404
    finally:
        shutil.rmtree(recipes_dir, ignore_errors=True)
