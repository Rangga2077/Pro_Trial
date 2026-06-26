# Implementation Plan 3: Projection UI Flow, Assets, and Figma Motion

## Goal

Ubah projection UI CoCI dari alur lama:

```text
idle/start gesture -> recipe menu -> cooking steps
```

menjadi alur baru:

```text
recipe menu -> ingredient and tool confirmation -> cooking steps
```

Pada alur baru, user langsung masuk ke menu masakan saat app terbuka. Gesture pemilihan menu tetap mengikuti logic menu selection yang sudah ada. Setelah recipe dipilih, UI transisi ke sesi pengecekan bahan dan alat. Cooking section baru bisa dibuka setelah minimal bahan required terpenuhi.

## Current State

Kode sekarang berada di:

- Frontend HUD state: `frontend/src/useProjectionHud.ts`
- Projection UI: `frontend/src/components/RecipeManager.tsx`
- Frontend recipe contract: `frontend/src/types/contracts.ts`
- Backend recipe schema: `backend/app/schemas/recipe.py`
- Backend gesture action contract: `backend/app/schemas/contracts.py`
- Backend gesture interpreter: `backend/app/services/gesture_actions.py`
- Recipe JSON: `data/recipes`

Mode frontend sekarang:

```ts
type ProjectionHudMode = 'idle' | 'menu' | 'cooking';
```

Mode target:

```ts
type ProjectionHudMode = 'menu' | 'ingredient_check' | 'cooking';
```

`idle` bisa dihapus dari pengalaman utama, atau dipertahankan sebagai fallback/debug state jika dibutuhkan untuk hardware setup. Untuk projection experience final, first screen harus menu.

## Session 1: Recipe Menu

### Behavior

- App langsung menampilkan menu recipe tanpa perlu gesture dua telunjuk untuk start.
- User memilih menu dengan gesture menu selection yang sudah ada.
- Recipe menu menampilkan:
  - daftar menu di sisi kiri atau tengah kiri,
  - nama masakan,
  - deskripsi singkat dari `recipe.description`,
  - metadata singkat seperti cuisine, difficulty, cook time,
  - gambar masakan yang melayang di samping menu bar,
  - hover/focus effect untuk recipe yang sedang terseleksi.
- Saat user memilih recipe, UI tidak langsung masuk cooking. UI masuk ke `ingredient_check`.

### Gesture Mapping

Reuse gesture menu yang sudah ada:

- `MENU_NEXT`: pindah pilihan menu.
- `MENU_PREVIOUS`: pindah pilihan menu jika gesture ini sudah aktif atau akan diaktifkan lagi.
- `SELECT_RECIPE`: memilih recipe dan masuk ke `ingredient_check`.
- `RESET_APP`: dari flow non-menu bisa kembali ke menu utama.

Catatan penting: backend `GestureActionInterpreter` sekarang mengubah mode internal ke `cooking` saat `CLOSED_FIST` menghasilkan `SELECT_RECIPE`. Ini perlu diubah supaya `SELECT_RECIPE` masuk ke mode backend baru `ingredient_check`, bukan langsung `cooking`.

## Session 2: Ingredient and Tool Confirmation

### Behavior

Setelah recipe dipilih:

- UI transisi dengan animasi dari menu ke section pengecekan bahan.
- Sisi kiri menampilkan checklist bahan:
  - `required`: minimal 5 bahan untuk setiap recipe,
  - `optional`: maksimal 10 bahan tambahan.
- Sisi kiri juga bisa menampilkan alat masak yang dibutuhkan.
- Tengah UI menampilkan kotak besar sebagai detection zone.
- Detection zone menerima data object detection dari backend.
- Saat bahan valid terdeteksi:
  - kotak detection utama mengecil,
  - kartu hasil detection bergeser ke sisi kanan,
  - item masuk ke list hasil scan berurutan.
- Jika required ingredients sudah terpenuhi, tombol/status "ready to cook" aktif.
- Jika user memberi bahan yang salah:
  - tampilkan warning yang jelas,
  - jangan lanjut ke cooking,
  - user bisa kembali ke menu section 1 dengan double index finger.

### Ingredient Requirements

Recipe data perlu ditambah metadata supaya UI dan backend tahu bahan mana yang required, optional, dan label YOLO apa yang dianggap match.

Target contract:

```ts
interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  notes?: string | null;
  required?: boolean;
  detection_labels?: string[];
  image_url?: string | null;
}

interface Utensil {
  name: string;
  required?: boolean;
  detection_labels?: string[];
  image_url?: string | null;
}

interface Recipe {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  servings?: number | null;
  difficulty?: string | null;
  cuisine?: string | null;
  ingredients: Ingredient[];
  utensils?: Utensil[];
  instructions: InstructionStep[];
}
```

Rules:

- Setiap recipe harus punya minimal 5 `ingredients` dengan `required: true`.
- Optional ingredients boleh 0 sampai 10.
- `detection_labels` berisi label yang mungkin keluar dari YOLO, misalnya `["rice", "bowl of rice", "cooked rice"]`.
- `image_url` recipe dipakai untuk floating dish image di session 1.
- `image_url` ingredient dipakai untuk thumbnail/checklist di session 2.

### Detection Contract

Untuk MVP, frontend bisa membaca `cv_update.data.objects` yang sudah ada dan mencocokkan label object dengan `detection_labels` recipe. Namun untuk versi yang lebih rapi, backend sebaiknya punya service pure untuk ingredient verification:

- `backend/app/services/ingredient_verification.py`
- input: selected recipe + object detections,
- output: required matched, optional matched, unexpected objects, ready status.

Jika hasil verification dikirim via WebSocket, contract bisa ditambah:

```ts
interface IngredientCheckStatus {
  recipe_id: string;
  required_total: number;
  required_detected: number;
  ready: boolean;
  matched: IngredientDetectionResult[];
  unexpected: Detection[];
}
```

Ini menjaga frontend tetap fokus ke rendering workflow, sementara backend tetap menjadi pemilik CV interpretation.

## Session 3: Cooking Steps

### Behavior

- Cooking section hanya bisa dimulai jika `ingredient_check.ready === true`.
- Layout cooking bisa memakai HUD yang sudah ada, tetapi masuknya harus dari ingredient confirmation.
- `NEXT_STEP` dan `PREVIOUS_STEP` tetap berjalan seperti sekarang.
- `BACK_TO_MENU` atau `RESET_APP` mengembalikan user ke recipe menu.

### Gesture Mapping

Target gesture:

- Di `menu`: gesture selection tetap sama.
- Di `ingredient_check`:
  - double index finger: reset/back to menu,
  - gesture confirm atau action baru: lanjut cooking hanya jika required terpenuhi,
  - jika required belum terpenuhi, action confirm menampilkan warning.
- Di `cooking`:
  - right index: next step,
  - left index: previous step,
  - closed fist atau action existing: back to menu jika tetap dipakai.

Potential new actions:

```ts
type GestureAction =
  | existing actions
  | 'INGREDIENTS_CONFIRM'
  | 'INGREDIENTS_READY'
  | 'INGREDIENTS_REJECTED';
```

`INGREDIENTS_READY` dan `INGREDIENTS_REJECTED` bisa juga tidak menjadi gesture action jika statusnya berasal dari object detection service, bukan gesture.

## Asset Strategy

Karena recipe JSON berada di `data/recipes` dan dibaca backend, asset path paling stabil untuk Vite/Electron adalah memakai public assets dengan URL relatif.

Recommended structure:

```text
frontend/public/recipe-assets/
  fried_rice/
    hero.webp
    rice.webp
    egg.webp
    soy_sauce.webp
    wok.webp
  kung_pao_chicken/
    hero.webp
    chicken.webp
    peanut.webp
    chili.webp
```

Recipe JSON example:

```json
{
  "id": "fried_rice",
  "title": "Yangzhou Fried Rice",
  "description": "A famous Chinese-style fried rice from Yangzhou.",
  "image_url": "/recipe-assets/fried_rice/hero.webp",
  "ingredients": [
    {
      "name": "Cooked Rice",
      "amount": 400,
      "unit": "g",
      "required": true,
      "detection_labels": ["rice", "cooked rice", "bowl"],
      "image_url": "/recipe-assets/fried_rice/rice.webp"
    }
  ]
}
```

Why `public`:

- path bisa disimpan langsung di JSON,
- Vite akan serve file dari root URL,
- tidak perlu import dinamis per file,
- mudah diganti dengan asset hasil Figma/export/generate.

Alternative:

- `frontend/src/assets` bagus untuk asset yang di-import langsung dari component.
- Untuk recipe-driven image dari JSON, `public/recipe-assets` lebih sederhana.

Asset format:

- Gunakan `.webp` untuk hero/menu/ingredient images.
- Gunakan `.png` hanya jika butuh transparency yang tajam.
- Hindari gambar terlalu gelap atau blur karena projection UI butuh readable dari jarak jauh.
- Rasio aman:
  - dish hero: `4:3` atau `1:1`,
  - ingredient thumbnail: `1:1`,
  - tool thumbnail: `1:1`.

## Figma Work Areas

Bagian yang paling cocok dikembangkan di Figma:

1. Menu composition
   - posisi menu bar,
   - floating dish image,
   - selected/hover/focus state,
   - recipe metadata badges,
   - empty/error/loading states.

2. Menu image motion
   - image hover lift,
   - subtle parallax,
   - image swap animation saat selected recipe berubah,
   - shadow/glow supaya gambar terasa melayang di projection surface.

3. Transition menu to ingredient check
   - menu list keluar atau mengecil,
   - selected dish image morph menjadi context header,
   - ingredient section masuk dengan staged animation.

4. Ingredient detection zone
   - kotak besar tengah,
   - scanning outline,
   - detection success state,
   - wrong object warning state,
   - ready state setelah required terpenuhi.

5. Detected item choreography
   - kotak tengah mengecil,
   - card bahan bergerak ke kanan,
   - stack/list detected objects,
   - checked state di ingredient list kiri.

6. Cooking entry transition
   - ready-to-cook state,
   - confirmation animation,
   - move into cooking HUD without feeling like a page reload.

Yang sebaiknya tidak dikunci terlalu detail di Figma:

- exact detection labels,
- backend verification logic,
- WebSocket payload details,
- timing final gesture cooldown,
- YOLO confidence threshold.

Figma sebaiknya menghasilkan:

- 3 top-level frames: `Menu`, `Ingredient Check`, `Cooking`.
- Variants untuk `Ingredient Check`: `empty`, `detecting`, `matched`, `wrong_item`, `ready`.
- Prototype transitions untuk:
  - selected recipe change,
  - select recipe to ingredient check,
  - detection card moves center to right,
  - ready to cooking.
- Exported raster assets untuk dish dan ingredient images jika belum ada asset asli.

## Frontend Implementation Steps

1. Update contracts
   - Tambah `image_url`, `required`, `detection_labels`, dan `utensils` di `frontend/src/types/contracts.ts`.
   - Tambah field yang sama di `backend/app/schemas/recipe.py`.
   - Update `docs/API_Contracts.md`.

2. Update recipe JSON
   - Tambah `image_url` untuk recipe.
   - Tandai minimal 5 ingredients sebagai `required: true`.
   - Tambah optional ingredients sampai maksimal 10 jika perlu.
   - Tambah `detection_labels`.
   - Tambah `utensils`.

3. Update HUD state machine
   - Ubah initial mode menjadi `menu`.
   - Tambah mode `ingredient_check`.
   - `selectRecipe()` harus set selected recipe lalu masuk `ingredient_check`, bukan `cooking`.
   - Tambah derived state untuk required/optional progress.
   - Cooking hanya aktif lewat `startCooking()` ketika required terpenuhi.

4. Update gesture action handling
   - `SELECT_RECIPE` di menu masuk `ingredient_check`.
   - Double index finger di `ingredient_check` kembali ke menu.
   - Confirm gesture di `ingredient_check` hanya masuk cooking kalau bahan ready.

5. Build UI components
   - Extract `RecipeMenuPanel`.
   - Tambah `FloatingRecipePreview`.
   - Tambah `IngredientCheckPanel`.
   - Tambah `IngredientChecklist`.
   - Tambah `DetectionZone`.
   - Tambah `DetectedObjectRail`.

6. Animate with Framer Motion
   - Use `AnimatePresence` untuk mode transition.
   - Use `layoutId` untuk selected recipe image jika ingin morph antar section.
   - Use `motion.div` variants untuk detection card center-to-right movement.

## Backend Implementation Steps

1. Update recipe schema
   - Tambah optional fields tanpa memecahkan recipe lama.
   - Validasi minimal 5 required ingredients bisa dimulai sebagai test/data validation, lalu diperketat setelah semua recipe data siap.

2. Update gesture interpreter
   - Tambah mode internal `ingredient_check`.
   - `SELECT_RECIPE` dari menu pindah ke `ingredient_check`.
   - Double index finger dari `ingredient_check` menghasilkan `RESET_APP` atau action baru `BACK_TO_MENU`.
   - Cooking gestures hanya aktif di `cooking`.

3. Add ingredient verification service
   - Pure service, testable tanpa camera.
   - Cocokkan detection label dengan selected recipe `detection_labels`.
   - Track matched required, optional, unexpected.
   - Expose ready boolean.

4. Update WebSocket contract if verification status is broadcast
   - Backend Pydantic model.
   - Frontend TypeScript type.
   - `docs/API_Contracts.md`.

## Testing Plan

Backend:

```powershell
backend\venv\Scripts\python.exe -m pytest backend\tests -p no:cacheprovider
```

Focused backend tests:

- `test_gesture_actions.py`
  - app starts in menu or double-index behavior matches new flow,
  - select recipe moves interpreter to ingredient_check,
  - ingredient_check confirm/back behavior,
  - cooking next/previous still works.
- New `test_ingredient_verification.py`
  - all required matched means ready,
  - missing required means not ready,
  - optional matched does not replace missing required,
  - unexpected object returns warning candidate.

Frontend:

```powershell
cd frontend
npm run build
npm run lint
```

Manual:

- App opens directly to menu.
- Menu selected image floats beside menu.
- Selecting recipe animates to ingredient check.
- Required list shows at least 5 items.
- Detection zone empty/matched/wrong/ready states render correctly.
- Cooking cannot start before required ingredients are ready.
- Double index finger in ingredient check returns to menu.

## Recommended Build Order

1. Design in Figma first for the three frames and ingredient states.
2. Add assets and recipe metadata.
3. Update contracts and docs.
4. Implement frontend state machine and static UI using mocked detection status.
5. Implement backend gesture mode changes.
6. Add ingredient verification service.
7. Connect real YOLO detections.
8. Polish animation timings and projection readability.

This order keeps the visual interaction testable before YOLO detection is fully reliable.
