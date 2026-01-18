import json
import os
from pathlib import Path
import random
import uuid
from typing import List, Optional
from app.schemas.recipe import Recipe, RecipeCreate, RecipeUpdate

class RecipeLoader:
    def __init__(self, recipes_dir="backend/app/engines/llm/recipes"):
        # Adjust path relative to where main.py is run usually, or use absolute
        self.base_path = Path(recipes_dir)
        if not self.base_path.exists():
             self.base_path = Path("app/engines/llm/recipes")
        
        # Ensure directory exists if we are going to save files
        if not self.base_path.exists():
            self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_recipe_path(self, recipe_id: str) -> Path:
        return self.base_path / f"{recipe_id}.json"

    def load_recipe(self, recipe_id: str) -> Optional[Recipe]:
        path = self._get_recipe_path(recipe_id)
        if not path.exists():
            # Try to find by title/filename if ID doesn't match a file directly
            for f in self.base_path.glob("*.json"):
                if f.stem == recipe_id:
                    path = f
                    break
            else:
                return None
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if not data: return None
                return Recipe(**data)
        except Exception as e:
            print(f"Error loading recipe {recipe_id}: {e}")
            return None

    def list_recipes(self) -> List[Recipe]:
        recipes = []
        if not self.base_path.exists():
            return []
        for f in self.base_path.glob("*.json"):
            recipe = self.load_recipe(f.stem)
            if recipe:
                recipes.append(recipe)
        return recipes

    def search_recipes(self, query: str) -> List[Recipe]:
        query = query.lower()
        all_recipes = self.list_recipes()
        return [
            r for r in all_recipes 
            if query in r.title.lower() or (r.description and query in r.description.lower())
        ]

    def create_recipe(self, recipe_in: RecipeCreate) -> Recipe:
        recipe_id = str(uuid.uuid4())
        recipe = Recipe(id=recipe_id, **recipe_in.model_dump())
        self._save_recipe(recipe)
        return recipe

    def update_recipe(self, recipe_id: str, recipe_in: RecipeUpdate) -> Optional[Recipe]:
        existing = self.load_recipe(recipe_id)
        if not existing:
            return None
        
        update_data = recipe_in.model_dump(exclude_unset=True)
        updated_recipe = existing.model_copy(update=update_data)
        self._save_recipe(updated_recipe)
        return updated_recipe

    def delete_recipe(self, recipe_id: str) -> bool:
        path = self._get_recipe_path(recipe_id)
        if path.exists():
            path.unlink()
            return True
        return False

    def _save_recipe(self, recipe: Recipe):
        path = self._get_recipe_path(recipe.id)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(recipe.model_dump(), f, indent=4)

    def get_random_recipe(self) -> Optional[Recipe]:
        recipes = self.list_recipes()
        if not recipes:
            return None
        return random.choice(recipes)

recipe_loader = RecipeLoader()
