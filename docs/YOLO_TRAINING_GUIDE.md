# CoCI Ingredient Detector: Training Guide (v2, self-recorded data)

This is the single reference for retraining `custom_ingredients.pt` on frames recorded at the CoCI station. It replaces the web-crawled dataset approach (v1) and supersedes `Training_YOLO.md`.

AI agents: section 4 is the implementation spec for the training tools. Follow `GUIDE.md`: no changes to `backend/app/`, `frontend/` or the recipe data.

---

## 0. At a glance

**Goal:** an ingredient detector that works on the real station, under these conditions:
- top-down camera, ingredients on the counter;
- projector light and HUD;
- hands in the frame.

**Acceptance bar (v2):**

| Metric (held-out session) | Target |
|---|---|
| mAP50, all trained classes | **≥ 0.70** |
| mAP50, every individual trained class | ≥ 0.60 |
| Recall, all classes | ≥ 0.70 |
| Live test (section 10.3) | all items detected within ~1 s, no false "soy_sauce" on other bottles, hands never boxed |

v1 baseline for comparison: mAP50 ≈ 0.26, recall ≈ 0.3.

**Pipeline:**

```
record_ingredient_frames.py ──► data/dataset/raw_images/<class>/clean/<session>_NNNN.jpg
            │                         (+ raw_images/background/clean/…)
            ▼
auto_label_dataset.py --val-session <id> --no-fallback
            │──► data/dataset/images/{train,val}, labels/{train,val}, dataset.yaml, classes.txt, needs_review.txt
            ▼
Manual review (X-AnyLabeling / Label Studio) ──► labels/.reviewed + backup copy
            ▼
train_yolo.py --model yolo11s.pt --target-weights …/candidate.pt
            ▼
Evaluate (metrics + live webcam test) ──► copy candidate.pt → custom_ingredients.pt
```

**Effort:**

| Stage | Time |
|---|---|
| Build and test the tools (with an agent) | 1–2 h |
| Record 3 sessions | ~20–30 min each |
| Review labels | ~1.5–2 h for ~1,100 images |
| Train | ~1–2 h on the RTX 3050 |
| Evaluate | ~30 min |

---

## 1. Starting point (after the cleanup)

| Item | State |
|---|---|
| `data/dataset/` | **Gone.** No images, labels or `dataset.yaml`; the next auto-label run recreates it. |
| `backend/app/engines/cv/weights/custom_ingredients.pt` | **Gone.** The app falls back to `yolov10n.pt` (COCO) until v2 is deployed. |
| `backend/scripts/auto_label_dataset.py` | Present (v1 behaviour, needs the changes in 4.3) |
| `backend/scripts/train_yolo.py` | Present, usable as is |
| `backend/scripts/record_ingredient_frames.py` | **Not written yet** (spec in 4.2) |
| `backend/yolov8s-worldv2.pt` | Present: the auto-labeler model |
| `.gitignore` | `data/`, `runs/` and `*.pt` are ignored, so datasets and weights stay local |

**Why v1 failed:**
- Only ~35 web images per class.
- Wrong images, such as a menu book returned for "chicken breast".
- Product shots that look nothing like the top-down station view.
- Unreviewed auto-labels, including a fake centered box whenever detection missed.

---

## 2. Scope: classes and demo recipes

### 2.1 Fixed class list (IDs never change)

The order is the same as v1, so IDs stay stable. New classes are only ever **appended**.

| ID | Class | YOLO-World prompt (auto-label) | Used by recipes |
|---|---|---|---|
| 0 | bell_pepper | bell pepper | Sweet & Sour Pork |
| 1 | carrot | carrot | Chow Mein, Fried Rice, Spring Rolls |
| 2 | chicken_breast_meat | raw chicken breast meat | Kung Pao, Chow Mein |
| 3 | chicken_egg | egg | Fried Rice, Hot & Sour Soup |
| 4 | garlic | garlic bulb | *(none)*: skip for now |
| 5 | ginger | ginger root | Jiaozi |
| 6 | peanuts | peanuts | Kung Pao |
| 7 | pork_loin | pork loin | Sweet & Sour Pork |
| 8 | scallion | scallion green onion | Mapo Tofu, Scallion Pancakes, Peking Duck |
| 9 | shiitake_mushroom | shiitake mushroom | Spring Rolls |
| 10 | soy_sauce | soy sauce bottle | Kung Pao, Fried Rice, Chow Mein, Jiaozi |
| 11 | tofu | tofu block | Mapo Tofu, Hot & Sour Soup |

`background` is **not** a class. It's a folder of negative images with empty labels.

### 2.2 v2 starter set

**Demo recipes:** Kung Pao Chicken, Yangzhou Fried Rice and Chow Mein. They share most of their trainable ingredients.

**Starter classes (5):** `chicken_breast_meat`, `peanuts`, `soy_sauce`, `chicken_egg`, `carrot`.

**Expansion set (after v2 passes):** `tofu` and `scallion`, which unlock Mapo Tofu.

Classes you don't record keep their IDs and simply have no data. That's fine: YOLO reports metrics only for classes that have validation instances.

### 2.3 Recipe ingredient → class mapping (for the future session-2 auto-tick)

Session 2 currently ticks ingredients by hand, and the DETECTED ITEMS panel is a placeholder. When auto-ticking is built, recipe ingredient names must be mapped to class labels. That mapping isn't part of this guide's work.

| Recipe ingredient name(s) | Class |
|---|---|
| Chicken Breast | chicken_breast_meat |
| Peanuts | peanuts |
| Soy Sauce, Dark Soy Sauce | soy_sauce |
| Eggs, Egg | chicken_egg |
| Carrots, Peas and Carrots | carrot |
| Tofu, Soft Tofu | tofu |
| Green Onions, Scallions, Spring Onion | scallion |
| Ginger | ginger |
| Shiitake Mushrooms | shiitake_mushroom |
| Pork Loin | pork_loin (do **not** map Ground Pork) |
| Bell Peppers | bell_pepper |

---

## 3. Folder layout (target)

```
backend/scripts/
  ingredient_classes.py          # NEW: single source of truth for class list + prompts (committed)
  record_ingredient_frames.py    # NEW: recorder
  auto_label_dataset.py          # UPDATED
  train_yolo.py                  # unchanged
backend/app/engines/cv/weights/
  custom_ingredients.pt          # deployed model (gitignored)
  candidate.pt                   # newest trained model, not yet deployed
data/dataset/                    # gitignored, local only
  raw_images/<class>/clean/<session>_NNNN.jpg
  raw_images/background/clean/<session>_NNNN.jpg
  images/{train,val}/   labels/{train,val}/
  dataset.yaml   classes.txt   needs_review.txt   previews/
  labels/.reviewed               # lock file after manual review
data/dataset_reviewed_<date>/    # backup copy after each review
data/runs/<run-name>/            # training output (results.csv, weights/best.pt, plots)
data/session_log.md              # your recording log (section 6.5)
```

---

## 4. Tooling to build (spec)

General rules:
- Windows-first.
- Use `PROJECT_ROOT = Path(__file__).resolve().parents[2]` like the existing scripts.
- Use only the existing dependencies (`opencv-python`, `ultralytics`, `imagehash`, `Pillow`, `pyyaml`).
- No changes under `backend/app/`.

### 4.1 `backend/scripts/ingredient_classes.py` (new)

The single source of truth, committed to git. `data/` is gitignored, so `dataset.yaml` can't be the source.

```python
CLASSES: list[str] = [
    "bell_pepper", "carrot", "chicken_breast_meat", "chicken_egg", "garlic", "ginger",
    "peanuts", "pork_loin", "scallion", "shiitake_mushroom", "soy_sauce", "tofu",
]  # append-only; never reorder
PROMPTS: dict[str, str] = {...}   # class -> YOLO-World prompt, from the table in 2.1
BACKGROUND = "background"
```

### 4.2 `backend/scripts/record_ingredient_frames.py` (new)

**CLI:**

| Flag | Default | Meaning |
|---|---|---|
| `--camera` | `settings.CAMERA_INDEX` | camera index |
| `--width` / `--height` | `settings.CAMERA_WIDTH` / `CAMERA_HEIGHT` | capture size |
| `--classes` | all `CLASSES` + `background` | comma-separated subset; `background` is always available |
| `--interval` | `0.5` | seconds between auto-saves |
| `--min-change` | `6` | min pHash Hamming distance from the last saved frame |
| `--video PATH` | — | extract from a video file instead of the camera (needs exactly one `--classes`) |
| `--session` | now, `%Y%m%d-%H%M` | session id override (for example to continue a session) |

**Behaviour:**
1. **Settings:** import `app.core.config.settings` by adding `backend/` to `sys.path`. Settings read `backend/.env`.
2. **Camera:** open it with `cv2.VideoCapture(index, cv2.CAP_DSHOW)` on Windows (`os.name == "nt"`), otherwise the default backend, and set the width and height.
   - If it can't be opened or the first read fails, print `Camera busy or missing — is the CoCI backend still running? (start_app.bat)` and exit with code 1.
3. **Start-up print:** the session id and the output root.
4. **Live window:** shows the frame with an overlay:
   - the current class and its saved count for this session;
   - auto-save ON/OFF;
   - the key help;
   - a brief green "SAVED" flash after each save.

   The overlay is drawn on a **copy**; saved frames are always clean.
5. **Saving:**
   - Path: `data/dataset/raw_images/<class>/clean/<session>_<NNNN>.jpg`, JPEG quality 95. Create folders as needed.
   - Numbering continues from the highest existing `<session>_NNNN` in that folder.
6. **Duplicate filter:**
   - Keep the `imagehash.phash` of the last saved frame for each class.
   - Auto-save writes only when `elapsed ≥ --interval` **and** `distance ≥ --min-change`.
   - `SPACE` always saves.
7. **Keys:**

   | Key | Action |
   |---|---|
   | `SPACE` | Save one frame |
   | `A` | Auto-save on/off |
   | `N` / `P` | Next / previous class (resets the hash) |
   | `B` | Jump to `background` |
   | `Q` / `Esc` | Quit and print a per-class summary for this session |

8. **`--video` mode:**
   - Same interval and duplicate logic, timed by the video position (`CAP_PROP_POS_MSEC`), not the clock.
   - No window. Prints the saved count.

**Acceptance tests** (manual, backend stopped):
- [ ] With `--classes carrot`, the preview shows the overlay, and the saved JPG has **no** overlay.
- [ ] With `A` on, roughly 2 frames/s save while the item moves; none save while it stays still.
- [ ] `N`/`P`/`B` switch folders and counts.
- [ ] Restarting with the same `--session` continues the numbering without overwriting files.
- [ ] With the backend running, the script prints the "Camera busy" message.
- [ ] `--video clip.mp4 --classes carrot` saves fewer than `duration × 2` frames for a clip with still parts.

### 4.3 `backend/scripts/auto_label_dataset.py` (update)

Keep all the existing flags. Change the following:

1. **Fixed IDs:**
   - Take class names and IDs from `ingredient_classes.CLASSES`, not from the folder names.
   - Prompts come from `PROMPTS`.
   - Skip unknown folders with a warning, apart from `background`.
2. **Prompt only what's present:** call `model.set_classes()` with the prompts for classes that have a raw folder with images, and map predictions back to their **fixed** IDs. Fewer prompts means fewer wrong boxes.
3. **Background:** for images in `background/`, copy the image, write an **empty** `.txt` file and skip detection.
4. **Multi-class frames:** keep detections of **every** prompted class, not only the folder's class. This replaces the `if cls_id_pred == cid` filter.
5. **`--no-fallback`:**
   - If nothing is detected, write an empty label instead of `0.5 0.5 0.8 0.8` and append the output image name to `data/dataset/needs_review.txt`.
   - Recommended for all self-recorded data.
6. **`--val-session ID`** (repeatable):
   - An image goes to `val` when its **source** file name (`img_path.name`, before the `<class>_` prefix is added) starts with one of the given IDs. Everything else goes to `train`.
   - Without the flag, the old random split applies.
   - Print the train/val counts per class and warn about any trained class with 0 val images.
7. **Outputs:**
   - `dataset.yaml` with `names` = the full `CLASSES` list (all 12, in order).
   - Also write `data/dataset/classes.txt` (one name per line, in ID order) for the labeling tools.
8. **Review lock:**
   - If `data/dataset/labels/.reviewed` exists, exit with a message, unless `--force` is passed. The run deletes `images/` and `labels/`.
   - Without `--force`, the clean-up must never run.
9. **Model path:** default `--model` resolves to `backend/yolov8s-worldv2.pt` so it isn't downloaded again into the working directory.

**Acceptance tests** (on a small recorded set):
- [ ] Background images get empty `.txt` files.
- [ ] Every file from `--val-session` lands in `val`, and nothing else does.
- [ ] `dataset.yaml` lists all 12 names in order, even with only 2 class folders present.
- [ ] A frame holding a carrot and an egg (in `carrot/`) gets boxes for both classes.
- [ ] With `--no-fallback`, `needs_review.txt` lists the empty-label frames, with no `0.5 0.5 0.8 0.8` boxes.
- [ ] With `.reviewed` present, the script refuses to run.

### 4.4 `train_yolo.py`

No code changes are needed. Always pass `--name` (one run folder per experiment) and `--target-weights …/candidate.pt` (see section 9).

### 4.5 Agent prompts (Antigravity, Plan mode)

> Implement section 4.1 and 4.2 of @docs/YOLO_TRAINING_GUIDE.md. Follow @GUIDE.md. Do not touch backend/app/. Do not run the recorder — I will test it with the webcam.

> Implement section 4.3 of @docs/YOLO_TRAINING_GUIDE.md in @backend/scripts/auto_label_dataset.py, using backend/scripts/ingredient_classes.py. Keep existing flags working. Do not run it on my data.

Commit before each task, and read the agent's implementation plan before approving it.

---

## 5. Station setup (do once, then don't touch)

1. Mount the **real CoCI camera** in its final position above the counter. Never use a phone camera: the lens and angle differ.
2. Mark the camera mount and the edges of the scan zone with tape so every session matches.
3. Check the image with the recorder preview:
   - The whole scan zone is visible.
   - The camera's autofocus has settled.
   - The image isn't overexposed under the projector.
4. Before **every** session, stop CoCI first: press ENTER in the `start_app.bat` window. Only one program can use the webcam on Windows.

---

## 6. Recording protocol

### 6.1 Session plan

| Session | Conditions | Use |
|---|---|---|
| S1 | Evening / lamp light, projector **on** with the HUD | train |
| S2 | Daylight, projector **off** and on | train |
| S3 | A different day, mixed light | **val** (held out) |

Rules:
- The val session (S3) must cover **every** class you're training, plus background.
- Record S3 on a **different day** from S1 and S2. Same-day frames are near-copies and inflate the score.
- Note each session id in `data/session_log.md` (6.5).

### 6.2 Per-session routine

Run:
```powershell
backend\venv\Scripts\python.exe backend\scripts\record_ingredient_frames.py --classes chicken_breast_meat,peanuts,soy_sauce,chicken_egg,carrot
```

For each class, spend about **2 minutes with auto-save on** (`A`). Work through this checklist:
- [ ] **Positions:** the 4 corners and the center of the scan zone.
- [ ] **Orientations:** rotate 360°, flip, stand upright and lay flat.
- [ ] **Hands:** held, half covered by fingers, being placed and being picked up.
- [ ] **Groups:** together with 1–2 other ingredients, sometimes overlapping.
- [ ] **Light:** projector on (HUD over the item) and projector off.
- [ ] **Distance:** at counter height, and lifted ~10–20 cm toward the camera ("hold item above the detection zone" is the actual session-2 instruction).

Then press `B` and record the **background** set (6.4).

### 6.3 Shot list per starter class

| Class | Forms to record | Watch out for |
|---|---|---|
| chicken_breast_meat | packaged tray (label visible and hidden); raw on a plate; **diced in a bowl** (the recipe says diced) | Shouldn't be confused with pork or tofu: put those in the background set |
| peanuts | in a small bowl; a loose pile; in a bag; a handful | Small object: include close, lifted shots |
| soy_sauce | the bottle upright, lying down and rotated so the label is front, back and side; 2 brands if possible; the dark soy bottle (Chow Mein) | **The most important confusers:** vinegar, sesame oil and hoisin bottles go in background |
| chicken_egg | single; 2–3 together; in the carton; in hand | Eggs vs. garlic or round items: put garlic in background |
| carrot | whole; peeled; sliced; diced in a bowl | Mixed with peas (fried rice) |

### 6.4 Background set (≈10% of all frames)

Background frames must contain **none** of the trained classes. Record:
- the empty counter, with projector on and off, and with the HUD's different screens;
- hands only: pointing, open palm, gestures;
- utensils, a cutting board, bowls and plates (empty);
- the menu book or recipe cards;
- **confusers:** recipe items that are *not* trained classes, such as rice vinegar, sesame oil, hoisin, dried chilis, cabbage, noodles, ham, garlic, tofu and ground pork. Tofu and scallion go here only until they're trained.

### 6.5 Session log (keep in `data/session_log.md`)

| Session id | Date | Light / projector | Role | Classes | Frames (per class) | Notes |
|---|---|---|---|---|---|---|
| 20261013-1930 | 2026-10-13 | lamp, proj on | train | 5 + bg | 160/150/170/155/165, bg 80 | |
| … | | | train | | | |
| … | | | **val** | | | |

### 6.6 Quantity targets

| | Per trained class | Background |
|---|---|---|
| Train sessions (S1+S2) | ≥ 150 frames | ~10% of the total |
| Val session (S3) | ≥ 40 frames | ~10% of S3 |

Count the frames per class:
```powershell
Get-ChildItem data\dataset\raw_images -Directory | ForEach-Object { "{0,-22} {1}" -f $_.Name, (Get-ChildItem "$($_.FullName)\clean\*.jpg").Count }
```

---

## 7. Auto-labeling

Run it **once**, after all sessions are recorded. Use the val session id from your log:
```powershell
backend\venv\Scripts\python.exe backend\scripts\auto_label_dataset.py --val-session 20261015-1600 --no-fallback --save-previews
```

Check:
- [ ] The summary shows train and val counts for every trained class (no "0 val" warning).
- [ ] `dataset.yaml` has all 12 names in order.
- [ ] `classes.txt` exists.
- [ ] Look through ~20 images in `data\dataset\previews\` to get a feel for the auto-label quality before the full review.
- [ ] Note how many entries `needs_review.txt` has.

If a prompt performs badly for one class (lots of misses or wrong boxes), change its prompt in `ingredient_classes.py` and re-run. That's allowed because nothing has been reviewed yet.

---

## 8. Manual review (this decides the model quality)

1. **Tool:** X-AnyLabeling or Label Studio (local). Load `data\dataset\images\train` with its labels from `labels\train` using the tool's YOLO import, with `data\dataset\classes.txt` as the class list. Then do the same for `val`.
2. **Order:** first the files in `needs_review.txt`, then everything else.
3. **For every image:**
   - [ ] Every visible trained-class item has a box, including partly covered items and items in hand.
   - [ ] Boxes are tight: edge to edge on the visible part, not the whole hand.
   - [ ] No box on a confuser (a vinegar bottle is **not** soy_sauce).
   - [ ] For a bowl of diced chicken or peanuts, draw **one** box around the food in the bowl, and do it the same way every time.
   - [ ] Delete frames that are unusable: heavy motion blur, or the item mostly out of frame.
4. **Background images:** confirm their labels are empty and no trained item slipped in.
5. **Export:** export YOLO format back into the **same** `labels\train` and `labels\val` folders. Then:
   ```powershell
   New-Item data\dataset\labels\.reviewed -ItemType File
   Copy-Item data\dataset data\dataset_reviewed_20261016 -Recurse
   ```

The **val** set must be reviewed as carefully as train. Wrong val labels make the metrics meaningless.

---

## 9. Training

**Smoke test** (about 2 min; checks the pipeline end to end):
```powershell
backend\venv\Scripts\python.exe backend\scripts\train_yolo.py --model yolo11s.pt --epochs 1 --batch 8 --name smoke --target-weights backend/app/engines/cv/weights/smoke.pt
```

**Full run:**
```powershell
backend\venv\Scripts\python.exe backend\scripts\train_yolo.py --model yolo11s.pt --epochs 120 --batch 8 --name v2_s1s2_val-s3 --target-weights backend/app/engines/cv/weights/candidate.pt
```

Notes:
- **Never** let training write directly to `custom_ingredients.pt`. Deploy only after the evaluation passes (section 11).
- `--batch 8` fits `yolo11s` at 640 px in 4 GB of VRAM. On `CUDA out of memory`, use `--batch 4`. If it's still too slow or too big, switch to `--model yolo11n.pt` (faster, slightly less accurate).
- `--workers 0` (the default) avoids Windows paging-file errors. Leave it.
- `yolo11s.pt` downloads to the project root on first use. It's gitignored (`*.pt`).
- Close CoCI and other GPU apps while training.
- Output: `data\runs\<name>\` with `results.csv`, `results.png`, `confusion_matrix.png`, `val_batch*_pred.jpg` and `weights\best.pt`.

---

## 10. Evaluation

### 10.1 Read the numbers

At the end of training, Ultralytics prints a per-class table (`Class  Images  Instances  P  R  mAP50  mAP50-95`). Re-run it at any time:
```powershell
backend\venv\Scripts\yolo.exe val model=backend\app\engines\cv\weights\candidate.pt data=data\dataset\dataset.yaml split=val batch=8
```

| Column | Meaning | What low means |
|---|---|---|
| P (precision) | Of the boxes the model drew, how many were right | False alarms: add confusers to background |
| R (recall) | Of the real items, how many it found | Missed items: more variety for that class |
| mAP50 | Overall detection quality at a loose box overlap | The headline number; target ≥ 0.70 |
| mAP50-95 | Same, with strict box tightness | Informative only; usually ~0.4–0.6 when mAP50 is good |

### 10.2 Look at the plots

In `data\runs\<name>\`:
- `results.png`: if val loss rises while train loss keeps falling, the model is overfitting. Add data or variety rather than epochs.
- `confusion_matrix.png`: shows which class gets mistaken for which. The background row and column show false alarms and misses.
- `val_batch0_pred.jpg` next to `val_batch0_labels.jpg`: what the model draws compared with the ground truth.

### 10.3 Live test at the station (backend stopped)

```powershell
backend\venv\Scripts\yolo.exe predict model=backend\app\engines\cv\weights\candidate.pt source=0 show=True conf=0.4
```
Use your `CAMERA_INDEX` from `backend\.env` as the `source` if it isn't 0.

Checklist:
- [ ] Each starter ingredient is detected within ~1 s when it's placed in the zone, and also when held above it.
- [ ] Two or three ingredients together are each detected.
- [ ] Vinegar, sesame oil and hoisin bottles are **not** detected as soy_sauce.
- [ ] Empty hands, utensils and the menu book produce no boxes.
- [ ] Works with the projector both on and off.

### 10.4 Pass / fail

- **Pass:** the section 0 targets are met and the live checklist is all ticked. Go to section 11.
- **Fail:** go to section 12.

---

## 11. Deploy and roll back

**Deploy:**
```powershell
Copy-Item backend\app\engines\cv\weights\candidate.pt backend\app\engines\cv\weights\custom_ingredients.pt -Force
Copy-Item backend\app\engines\cv\weights\candidate.pt backend\app\engines\cv\weights\custom_ingredients_v2_20261016.pt
.\start_app.bat
```
The backend console should print `YOLO model loaded: …custom_ingredients.pt`. In session 2, check that the labels and boxes show on the camera feed.

**Roll back:** copy an earlier `custom_ingredients_vX_*.pt` over `custom_ingredients.pt`. Or delete `custom_ingredients.pt` to fall back to `yolov10n.pt`.

Keep a line per model in `data/session_log.md`: model file, training sessions, val session, mAP50, and whether it passed the live test.

---

## 12. Iteration loop (when below target)

Fix the **data** first. Change training settings only after that.

| Symptom | Likely cause | Fix |
|---|---|---|
| One class has low R | Too few or too uniform frames | Record a focused session for that class: more positions, in hand, partly covered |
| Low R on peanuts or small items | Objects too small at 640 px | More close and lifted shots; optionally retrain with `imgsz=960` (needs `--batch 4`) |
| Low P on soy_sauce | Other bottles get detected | More confuser bottles in background; check the review didn't box them |
| Hands get boxed | Too few hand-only negatives | More background frames with hands only and gestures |
| Fine with projector off, bad with it on | Light imbalance | Record more with the HUD projected on the items |
| Val far below train | Val conditions not covered in train, or val labels wrong | Re-check the val labels; add a train session with similar light |
| Everything low | Label quality | Re-review: tight boxes, every item boxed, consistent bowl rule |

**After each new recording session:**
1. Remove the lock file: `Remove-Item data\dataset\labels\.reviewed`. Back up first; `--force` re-runs delete the reviewed labels.
2. Re-run auto-labeling with `--force`.
3. **Re-import** the reviewed labels from the backup for the images you already reviewed. Images keep their names, so copying `labels` from the backup over the new ones works. Then review **only the new session's** images.
4. Retrain with a new `--name` and compare it with the previous run.

---

## 13. Troubleshooting

| Problem | Fix |
|---|---|
| Recorder: "Camera busy" | CoCI is still running: press ENTER in the `start_app.bat` window, or end leftover `python.exe` processes |
| Recorder shows a black or wrong camera | Wrong index: pass `--camera 1` (and update `CAMERA_INDEX` in `backend\.env` to match the app) |
| Auto-label downloads YOLO-World again | Pass `--model backend\yolov8s-worldv2.pt` |
| Auto-label refuses to run | `labels\.reviewed` exists (by design); see section 12 |
| `CUDA out of memory` | `--batch 4`, or `--model yolo11n.pt` |
| `WinError 1455` (paging file) | Keep `--workers 0`; close other apps |
| Training is on the CPU | `torch.cuda.is_available()` is False: reinstall the CUDA build of torch in the venv |
| The app still shows COCO labels | `custom_ingredients.pt` is missing or misnamed in `backend\app\engines\cv\weights\` |

---

## 14. Command cheat sheet (PowerShell, project root)

```powershell
# Record
backend\venv\Scripts\python.exe backend\scripts\record_ingredient_frames.py --classes chicken_breast_meat,peanuts,soy_sauce,chicken_egg,carrot

# Auto-label (once, after all sessions)
backend\venv\Scripts\python.exe backend\scripts\auto_label_dataset.py --val-session <VAL_ID> --no-fallback --save-previews

# Lock + back up after review
New-Item data\dataset\labels\.reviewed -ItemType File
Copy-Item data\dataset data\dataset_reviewed_<DATE> -Recurse

# Train
backend\venv\Scripts\python.exe backend\scripts\train_yolo.py --model yolo11s.pt --epochs 120 --batch 8 --name <RUN> --target-weights backend/app/engines/cv/weights/candidate.pt

# Evaluate
backend\venv\Scripts\yolo.exe val model=backend\app\engines\cv\weights\candidate.pt data=data\dataset\dataset.yaml split=val
backend\venv\Scripts\yolo.exe predict model=backend\app\engines\cv\weights\candidate.pt source=0 show=True conf=0.4

# Deploy
Copy-Item backend\app\engines\cv\weights\candidate.pt backend\app\engines\cv\weights\custom_ingredients.pt -Force
```

---

## 15. Rules

- Never reorder `CLASSES`; only append.
- Never record the val session on the same day as the train sessions.
- Never re-run auto-labeling over reviewed labels without a backup.
- Never deploy a model that hasn't passed both the metrics and the live test.
- Never add web-crawled images back into `raw_images/`.
- No changes to `backend/app/` or `frontend/` are needed for training. Auto-ticking in session 2 is a separate task.
