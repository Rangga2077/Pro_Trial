from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.schemas.recipe import Recipe, RecipeCreate, RecipeUpdate
from app.services.recipe_loader import recipe_loader

router = APIRouter()

@router.get("/", response_model=List[Recipe])
def get_recipes(q: Optional[str] = Query(None, description="Search query for recipes")):
    if q:
        return recipe_loader.search_recipes(q)
    return recipe_loader.list_recipes()

@router.get("/random", response_model=Recipe)
def get_random_recipe():
    recipe = recipe_loader.get_random_recipe()
    if not recipe:
        raise HTTPException(status_code=404, detail="No recipes found")
    return recipe

@router.get("/{recipe_id}", response_model=Recipe)
def get_recipe(recipe_id: str):
    recipe = recipe_loader.load_recipe(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe

@router.post("/", response_model=Recipe)
def create_recipe(recipe_in: RecipeCreate):
    return recipe_loader.create_recipe(recipe_in)

@router.put("/{recipe_id}", response_model=Recipe)
def update_recipe(recipe_id: str, recipe_in: RecipeUpdate):
    recipe = recipe_loader.update_recipe(recipe_id, recipe_in)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe

@router.delete("/{recipe_id}")
def delete_recipe(recipe_id: str):
    success = recipe_loader.delete_recipe(recipe_id)
    if not success:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"message": "Recipe deleted"}
