import sys
import os
from pathlib import Path

# Add the backend directory to sys.path to allow imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from app.engines.llm.recipes.recipe_loader import recipe_loader
from app.schemas.recipe import RecipeCreate, Ingredient, InstructionStep

def test_loader():
    print("--- Testing Recipe Loader ---")
    
    # 1. List recipes
    recipes = recipe_loader.list_recipes()
    print(f"Total recipes found: {len(recipes)}")
    for r in recipes:
        print(f" - {r.title} ({r.cuisine})")

    # 2. Get random recipe
    random_recipe = recipe_loader.get_random_recipe()
    if random_recipe:
        print(f"\nRandom Recipe: {random_recipe.title}")
        print(f"Description: {random_recipe.description}")
        print(f"First Ingredient: {random_recipe.ingredients[0].name}")

    # 3. Search
    print("\nSearching for 'Chicken':")
    search_results = recipe_loader.search_recipes("Chicken")
    for r in search_results:
        print(f" - {r.title}")

    # 4. Create a new recipe
    print("\nCreating a new recipe...")
    new_recipe_in = RecipeCreate(
        title="Test Ramen",
        description="A simple test ramen",
        ingredients=[Ingredient(name="Noodles", amount=1, unit="pack")],
        instructions=[InstructionStep(step=1, description="Boil water")]
    )
    new_recipe = recipe_loader.create_recipe(new_recipe_in)
    print(f"Created recipe with ID: {new_recipe.id}")

    # 5. Cleanup test recipe
    print(f"Deleting test recipe {new_recipe.id}...")
    recipe_loader.delete_recipe(new_recipe.id)
    print("Deleted successfully.")

if __name__ == "__main__":
    test_loader()
