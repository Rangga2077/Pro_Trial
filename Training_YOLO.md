# Plan: Record your own YOLO training data at the CoCI station

## Context
The trained ingredient model (`backend/app/engines/cv/weights/custom_ingredients.pt`) is too weak to drive session 2:
- **Score:** mAP50 ≈ 0.26 and recall ≈ 0.3.
- **Too little data:** `data/dataset` has only 419 images, about 35 per class (garlic 15 boxes, soy sauce 16).
- **Wrong kind of images:** they come from `icrawler` web searches, mostly single-object product shots. Some are simply wrong, such as a menu book returned for "chicken breast". The YOLO-World auto-labeler then boxes those wrong images anyway.
- **Mismatch with the real setup:** the camera sees ingredients from above, on a counter, under projector light, with hands present.

The user wants to record the training data themselves. This plan gives them a recording tool and a recording routine. It also fixes two gaps in the existing pipeline so that self-recorded data trains well:
- "Nothing here" (background) images need to train correctly.
- The validation set must not contain near-copies of the training frames.

## How recording works (user's view)
1. Stop the CoCI backend. Windows lets only one program use the webcam.
2. `backend\venv\Scripts\python.exe backend\scripts\record_ingredient_frames.py`
3. A live camera window opens, showing the current class, the number of frames saved and the controls.

   | Key | Action |
   |---|---|
   | `SPACE` | Save one frame |
   | `A` | Auto-save on/off: one frame every 0.5 s while you move the item |
   | `N` / `P` | Next / previous class |
   | `B` | Jump to `background` (an empty counter, hands only, utensils, the menu book) |
   | `Q` | Quit |

4. Frames land in `data/dataset/raw_images/<class>/clean/`, the folder `auto_label_dataset.py` already reads. Each file name starts with a session id (date and time).

## Recording routine (about 1–2 minutes per ingredient, per session)
- **Camera:** use the real CoCI camera, mounted where it will be used. Don't use a phone camera, because its angle and lens differ.
- **Variety (this matters most):**
  - Move, rotate and flip the item. Place it in different areas of the zone.
  - Hold it in your hand, and lay it down.
  - Use 2–3 ingredients together, sometimes with one partly covered.
  - Projector on and off; daylight and lamp light.
  - Different forms where they apply: whole and cut carrot, packaged and unpackaged chicken.
- **Background class:** about 10% of all frames. Include the empty counter, hands, utensils, the menu book, and the projected HUD with no ingredient.
- **Sessions:** record at least 2 sessions on different days or under different lighting. One session becomes the validation set.
- **Target:** at least 150 frames per class across sessions, which is about 3 auto-save minutes. Start with the ingredients of 2–3 demo recipes rather than all 12 classes.

## Changes

### 1. New `backend/scripts/record_ingredient_frames.py`
- **Camera:** `CAMERA_INDEX`, `CAMERA_WIDTH` and `CAMERA_HEIGHT` come from `app.core.config.settings`. Open it with `cv2.CAP_DSHOW` on Windows, as `ThreadedCamera` in `backend/app/engines/cv/pipeline.py` does. Overrides: `--camera`, `--width`, `--height`.
- **Classes:** read from `data/dataset/dataset.yaml` `names`, plus `background`. `--classes` limits the list; a new name creates a folder.
- **Preview window:** the label overlay is drawn only on the preview; saved frames are clean.
- **Saving:** frames go to `data/dataset/raw_images/<class>/clean/<session>_<0001>.jpg`.
- **Auto-save:** `--interval` (default 0.5 s). Near-duplicate frames are skipped using `imagehash.phash` (already in `requirements.txt`) with a Hamming distance below `--min-change` (default 6), so holding still doesn't fill the folder.
- **`--video PATH`:** extracts frames from an existing recording with the same interval and duplicate skipping, for videos already filmed with the CoCI camera.
- **Clear errors:** if the camera can't be opened, say the backend is probably still running.

### 2. `backend/scripts/auto_label_dataset.py`
- **`background`:** write an empty `.txt` label per image (YOLO's "no objects" format) and skip auto-detection. Keep it out of `dataset.yaml` names.
- **New `--val-session SESSION_ID`:** put every image whose file name starts with that session into `val`, and everything else into `train`. Without the flag, keep today's random split.
- **Sources:** existing crawled images in `raw_images/<class>/clean/` still work. Recommend deleting or moving the crawled sets so the self-recorded data dominates.

### 3. Review step (documented, no code)
- After auto-labeling, review the boxes in a local tool such as Label Studio or X-AnyLabeling, which can import YOLO format.
- Fix wrong boxes, delete junk, and add missed items. This replaces trusting the 0.30-threshold auto-labels.

### 4. Retrain (existing tool)
- `backend/scripts/train_yolo.py --model yolo11s.pt --epochs 120`. It already copies `best.pt` to `custom_ingredients.pt`.
- **Bar for session 2 auto-ticking:** mAP50 ≥ 0.7 on the held-out session.

### 5. Docs
- Add a "Recording your own training data" section to `docs/HARDWARE_SETUP.md` (camera position, the routine above, the commands).

## Verification
1. **Tool test:** run `record_ingredient_frames.py --classes carrot` with the backend stopped.
   - The preview shows the overlay.
   - `SPACE` saves one clean frame without the overlay.
   - `A` saves about 2 frames per second while the item moves and stops saving when nothing changes.
   - `N` and `B` switch folders.
2. **Video mode:** `--video` on a short `.mp4` produces frames with duplicates skipped.
3. **Labeling:** `auto_label_dataset.py --val-session <id>` on a small recorded set.
   - `background` images get empty `.txt` files.
   - All files from that session are in `val`.
   - `dataset.yaml` names are unchanged.
4. **Training smoke test:** `train_yolo.py --epochs 1` on the result runs end to end.
5. **No app changes:** existing backend tests are unaffected, because no app code changes.
