# Future Roadmap: UI Redesign & YOLO Training

Since you want to jump into Figma to design the ultimate Kitchen AR experience before we write the React code, I have structured a battle plan. This outlines how you should construct your Figma components so they map perfectly to our React engine, alongside a robust data engineering strategy to teach our YOLO model how to detect your specific cooking ingredients!

## 1. UI/UX Figma Design Strategy

I generated an AI mockup to help inspire your Figma workflow. Feel free to use these visual cues (glassmorphism, vibrant accents, dark mode) as a baseline!

![UI Inspiration Mockup](C:/Users/Rangga%20Saputra/.gemini/antigravity/brain/2827e51b-6929-40c0-bda2-7fbfc4697032/kitchen_ar_hud_mockup_1776583907277.png)

When putting the layout together in Figma, try to organize your layers into these **Three Core Layout Components** so they translate instantly into our React code:

### A. The Instruction Engine
- **What it is:** The central text box for steps.
- **Figma Tip:** Design this with a transparent / glassmorphism background (e.g., `Fill: #FFFFFF at 5%` with `Background Blur: 20px`). Make sure the text is dynamic (Auto-Layout enabled) so long instructions wrap correctly.

### B. The `UtensilDock`
- **What it is:** A sidebar or floating tray identifying pans, pots, and stove status.
- **Figma Tip:** Design this as a vertical container heavily reliant on SVG icons. We will eventually tie this directly into the YOLO bounding box outputs.

### C. The `CookingTimers`
- **What it is:** Circular or progress-bar-based timer boxes.
- **React Mapping:** We will need to design an "Active Timer" state and an "Idle/Done Timer" state so the UI pulses when food needs to be flipped.

---

## 2. Custom YOLOv10 "Ingredients" Training Strategy

Right now, we use the pre-trained `yolov10n.pt` model, which detects generic COCO objects (cell phones, chairs, cups). To detect specific ingredients (e.g., *Onion, Tomato, Chicken Breast, Garlic*), we must build a custom dataset and perform **Transfer Learning**.

### Phase 1: Data Gathering
Because lighting in a kitchen differs wildly from internet photos, the best performing model will be trained on your own physical camera.
1. Place ingredients on your cutting board.
2. Record a 30-second video with your AverMedia webcam moving ingredients around.
3. Extract frames from the video using a quick Python script (e.g., 1 frame every second) to generate hundreds of images instantly.

### Phase 2: Annotation (Roboflow)
1. Upload the frames to a free tool like **Roboflow**.
2. Draw bounding boxes around the ingredients and label them (e.g., `sliced_onion`, `whole_tomato`).
3. Apply *Data Augmentations* (rotation, brightness shifts, blur) to artificially balloon your dataset size to 2,000+ images. 
4. Export the dataset in `YOLOv8/10` PyTorch format.

### Phase 3: Fine-Tuning the Engine
We will write a `train.py` script locally that takes your Roboflow dataset and injects it into our YOLO architecture:
```python
from ultralytics import YOLO

# Load the base model
model = YOLO("yolov10n.pt") 

# Train the model on your custom dataset config
results = model.train(data="your_ingredients.yaml", epochs=100, imgsz=640)
```

### Phase 4: Integration
The training will spit out a new file called `best.pt`. All we have to do is rename it to `yolov10_custom.pt`, drop it into our new `backend/app/engines/cv/weights/` directory, and update `yolo.py` to load this custom model!

---

> [!IMPORTANT]
> **Next steps:** Dive into Figma and design the UI components based on the guidelines above. In the meantime, start making a list of the exact 5-10 core ingredients you want the model to be able to recognize first!

Does this high-level strategy make sense for your upcoming work?
