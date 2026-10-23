"""
ingredient_classes.py
---------------------
Single source of truth for the ingredient detector's class list and the
YOLO-World prompts used by the auto-labeler. Used by the training tools
(record_ingredient_frames.py, auto_label_dataset.py).

CLASSES is append-only: a class ID is its index, so never reorder or remove
entries. New classes go at the end.
"""

from typing import Dict, List

CLASSES: List[str] = [
    "bell_pepper",
    "carrot",
    "chicken_breast_meat",
    "chicken_egg",
    "garlic",
    "ginger",
    "peanuts",
    "pork_loin",
    "scallion",
    "shiitake_mushroom",
    "soy_sauce",
    "tofu",
]  # append-only; never reorder

PROMPTS: Dict[str, str] = {
    "bell_pepper": "bell pepper",
    "carrot": "carrot",
    "chicken_breast_meat": "raw chicken breast meat",
    "chicken_egg": "egg",
    "garlic": "garlic bulb",
    "ginger": "ginger root",
    "peanuts": "peanuts",
    "pork_loin": "pork loin",
    "scallion": "scallion green onion",
    "shiitake_mushroom": "shiitake mushroom",
    "soy_sauce": "soy sauce bottle",
    "tofu": "tofu block",
}

# Folder of negative frames (no trained class visible). Not a class: its labels are empty.
BACKGROUND = "background"

CLASS_TO_ID: Dict[str, int] = {name: idx for idx, name in enumerate(CLASSES)}

assert set(PROMPTS) == set(CLASSES), "every class needs a YOLO-World prompt"
