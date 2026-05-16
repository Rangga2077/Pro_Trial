from pydantic import BaseModel, Field
from typing import List, Optional

class Ingredient(BaseModel):
    name: str
    amount: float
    unit: str
    notes: Optional[str] = None

class InstructionStep(BaseModel):
    step: int
    description: str
    timer_minutes: Optional[int] = None

class RecipeBase(BaseModel):
    title: str
    description: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    servings: Optional[int] = None
    difficulty: Optional[str] = "Medium" # Easy, Medium, Hard
    cuisine: Optional[str] = "Global"

class RecipeCreate(RecipeBase):
    ingredients: List[Ingredient]
    instructions: List[InstructionStep]

class RecipeUpdate(RecipeBase):
    title: Optional[str] = None
    ingredients: Optional[List[Ingredient]] = None
    instructions: Optional[List[InstructionStep]] = None

class Recipe(RecipeBase):
    id: str
    ingredients: List[Ingredient]
    instructions: List[InstructionStep]
