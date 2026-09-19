"""
fetch_ingredient_images.py
--------------------------
Automated & Manual-Friendly Ingredient Image Scraper for YOLO datasets.
Uses Wikimedia Commons API (high precision, curated public domain ingredient photos)
or icrawler (Bing/Google/Baidu) with post-download quality filtering and 
perceptual hash deduplication (imagehash).

Interactive Usage:
  python backend/scripts/fetch_ingredient_images.py
  (Prompts for ingredient name and number of images interactively)

CLI Usage:
  python backend/scripts/fetch_ingredient_images.py --ingredient "soy sauce" --max-num 15
  python backend/scripts/fetch_ingredient_images.py --ingredients garlic chicken_breast bell_pepper --max-num 20
"""

import argparse
import os
import shutil
import sys
from pathlib import Path
from typing import Dict, List

import requests
from PIL import Image

try:
    import imagehash
    from icrawler.builtin import BaiduImageCrawler, BingImageCrawler, GoogleImageCrawler
except ImportError:
    print("[WARNING] Required packages 'icrawler' or 'imagehash' not found.")
    print("Run: pip install icrawler imagehash pillow requests")

# Determine Project Root directory dynamically (Pro_Trial root)
# file location: backend/scripts/fetch_ingredient_images.py -> parents[2] is Pro_Trial
PROJECT_ROOT = Path(__file__).resolve().parents[2]


# Default fallback ingredient query mapping
DEFAULT_INGREDIENT_QUERIES: Dict[str, List[str]] = {
    "garlic": [
        "raw garlic clove",
        "peeled garlic cloves",
        "fresh garlic bulb",
        "chopped garlic",
    ],
    "chicken_breast": [
        "raw chicken breast",
        "raw diced chicken breast",
        "fresh chicken breast slice",
    ],
    "bell_pepper": [
        "raw red bell pepper",
        "green bell pepper whole",
        "sliced bell pepper raw",
    ],
    "soy_sauce": [
        "soy sauce bottle",
        "dark soy sauce bottle",
        "soy sauce",
    ],
    "ginger": [
        "ginger root",
        "fresh raw ginger",
        "sliced ginger root",
    ],
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Scrape and clean ingredient images for YOLO training dataset."
    )
    parser.add_argument(
        "--ingredient",
        type=str,
        default=None,
        help="Single ingredient name (e.g., 'soy sauce', 'garlic', 'ginger').",
    )
    parser.add_argument(
        "--ingredients",
        nargs="+",
        default=None,
        help="List of ingredient keys to scrape (e.g. garlic chicken_breast bell_pepper soy_sauce).",
    )
    parser.add_argument(
        "--max-num",
        type=int,
        default=15,
        help="Maximum images to download per query keyword (default: 15).",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="data/dataset/raw_images",
        help="Base directory to store raw and cleaned images.",
    )
    parser.add_argument(
        "--min-width",
        type=int,
        default=300,
        help="Minimum image width in pixels (default: 300).",
    )
    parser.add_argument(
        "--min-height",
        type=int,
        default=300,
        help="Minimum image height in pixels (default: 300).",
    )
    parser.add_argument(
        "--crawler",
        type=str,
        choices=["wikimedia", "bing", "google", "baidu"],
        default="wikimedia",
        help="Search engine crawler backend (default: wikimedia).",
    )
    parser.add_argument(
        "--skip-dedupe",
        action="store_true",
        help="Skip perceptual hash deduplication pass.",
    )
    parser.add_argument(
        "--interactive",
        "-i",
        action="store_true",
        help="Force interactive console prompt mode.",
    )
    return parser.parse_args()


def sanitize_folder_name(name: str) -> str:
    """Converts user input like 'soy sauce' or 'Chicken Breast!' to clean folder key 'soy_sauce'."""
    clean = name.strip().lower().replace(" ", "_").replace("-", "_")
    return "".join(c for c in clean if c.isalnum() or c == "_")


def generate_queries_for_input(name: str) -> List[str]:
    """Generates a list of targeted search query variations for an ingredient name."""
    clean_key = sanitize_folder_name(name)
    if clean_key in DEFAULT_INGREDIENT_QUERIES:
        return DEFAULT_INGREDIENT_QUERIES[clean_key]

    raw_name = name.strip().lower()
    return [
        raw_name,
        f"raw {raw_name}",
        f"fresh {raw_name}",
        f"{raw_name} ingredient",
    ]


def crawl_wikimedia(query: str, raw_dir: Path, max_num: int, query_idx: int):
    """Downloads curated ingredient photos directly from Wikimedia Commons API (web-optimized 800px previews)."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": "CoCIAgent/1.0 (contact@coci.local)"}
    url = (
        f"https://commons.wikimedia.org/w/api.php?action=query&generator=search"
        f"&gsrsearch={query}&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&gsrlimit={max_num}"
    )
    try:
        res = requests.get(url, headers=headers, timeout=15)
        if res.status_code != 200:
            print(f"    [Wikimedia Error] HTTP {res.status_code}")
            return
        data = res.json()
        pages = data.get("query", {}).get("pages", {})
        count = 0
        for page_id, page in pages.items():
            image_info = page.get("imageinfo", [])
            if not image_info:
                continue
            # Prefer thumburl (800px preview) to avoid downloading 30MB raw camera files
            img_url = image_info[0].get("thumburl") or image_info[0].get("url")
            if not img_url or img_url.endswith(".pdf") or img_url.endswith(".svg"):
                continue

            try:
                img_res = requests.get(img_url, headers=headers, timeout=10)
                if img_res.status_code == 200:
                    count += 1
                    ext = Path(img_url).suffix.split("?")[0].lower()
                    if ext not in [".jpg", ".jpeg", ".png"]:
                        ext = ".jpg"
                    file_path = raw_dir / f"wiki_q{query_idx}_{count:04d}{ext}"
                    with open(file_path, "wb") as f:
                        f.write(img_res.content)
            except Exception:
                continue
        print(f"    -> Downloaded {count} raw images from Wikimedia for '{query}'")
    except Exception as e:
        print(f"    [Wikimedia Exception] {e}")


def crawl_ingredient_raw(
    ingredient: str,
    queries: List[str],
    raw_dir: Path,
    max_num: int,
    crawler_name: str,
):
    """Downloads raw images into raw_dir."""
    if raw_dir.exists():
        try:
            shutil.rmtree(raw_dir)
        except Exception:
            pass
    raw_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[CRAWL] Starting '{crawler_name}' crawler for ingredient: '{ingredient}'")

    if crawler_name == "wikimedia":
        for idx, query in enumerate(queries, 1):
            print(f"  ({idx}/{len(queries)}) Searching query: '{query}'...")
            crawl_wikimedia(query=query, raw_dir=raw_dir, max_num=max_num, query_idx=idx)
    else:
        if crawler_name == "google":
            crawler_cls = GoogleImageCrawler
        elif crawler_name == "baidu":
            crawler_cls = BaiduImageCrawler
        else:
            crawler_cls = BingImageCrawler

        for idx, query in enumerate(queries, 1):
            print(f"  ({idx}/{len(queries)}) Searching query: '{query}'...")
            crawler = crawler_cls(
                downloader_threads=4,
                storage={"root_dir": str(raw_dir)},
                log_level=30,
            )
            crawler.crawl(keyword=query, max_num=max_num)


def clean_and_dedupe(
    raw_dir: Path,
    clean_dir: Path,
    ingredient_key: str,
    min_width: int,
    min_height: int,
    skip_dedupe: bool = False,
) -> int:
    """Filters corrupted/small images and removes duplicates using perceptual hashing."""
    if clean_dir.exists():
        try:
            shutil.rmtree(clean_dir)
        except Exception:
            pass
    clean_dir.mkdir(parents=True, exist_ok=True)

    if not raw_dir.exists():
        print(f"  [CLEAN] Raw directory {raw_dir} does not exist")
        return 0

    raw_files = [f for f in raw_dir.iterdir() if f.is_file()]
    if not raw_files:
        print(f"  [CLEAN] No raw files found in {raw_dir}")
        return 0

    seen_hashes: List[imagehash.ImageHash] = []
    valid_count = 0

    print(f"[CLEAN] Filtering & deduplicating {len(raw_files)} raw images for '{ingredient_key}'...")

    for file_path in raw_files:
        try:
            with Image.open(file_path) as img:
                img.verify()

            # Re-open after verify() to inspect size and hash
            with Image.open(file_path) as img:
                width, height = img.size
                if width < min_width or height < min_height:
                    continue  # Image too small

                if not skip_dedupe:
                    img_hash = imagehash.average_hash(img)
                    # Check Hamming distance against already saved hashes
                    is_duplicate = False
                    for existing_hash in seen_hashes:
                        if img_hash - existing_hash <= 4:  # Threshold for near-duplicates
                            is_duplicate = True
                            break
                    if is_duplicate:
                        continue
                    seen_hashes.append(img_hash)

                # Copy clean valid file
                valid_count += 1
                extension = file_path.suffix.lower()
                if extension not in [".jpg", ".jpeg", ".png"]:
                    extension = ".jpg"
                clean_target = clean_dir / f"{ingredient_key}_{valid_count:04d}{extension}"
                shutil.copy2(file_path, clean_target)

        except Exception:
            # Skip corrupted or unreadable images
            continue

    print(f"  [RESULT] '{ingredient_key}': {valid_count} clean valid images saved -> {clean_dir}")
    return valid_count


def main():
    args = parse_args()
    
    # Always resolve output directory relative to project root (Pro_Trial) if relative
    raw_output_path = Path(args.output_dir)
    if not raw_output_path.is_absolute():
        output_base = PROJECT_ROOT / raw_output_path
    else:
        output_base = raw_output_path

    # Determine execution mode (Interactive vs CLI args)
    is_no_arg = (
        len(sys.argv) == 1
        or (len(sys.argv) == 2 and sys.argv[1] in ["-i", "--interactive"])
    )

    ingredients_to_process: List[str] = []
    max_num = args.max_num

    if is_no_arg or args.interactive:
        print("=" * 60)
        print("      MANUAL INGREDIENT IMAGE SCRAPER (Interactive Mode)      ")
        print("=" * 60)
        try:
            user_input = input("Enter ingredient name (e.g. 'soy sauce', 'garlic', 'ginger'): ").strip()
            if not user_input:
                print("[ERROR] No ingredient name entered. Exiting.")
                return
            ingredients_to_process = [user_input]

            num_input = input("Max clean images to fetch [default 15]: ").strip()
            if num_input.isdigit():
                max_num = int(num_input)
        except (KeyboardInterrupt, EOFError):
            print("\n[CANCELLED] Interrupted by user.")
            return
    else:
        if args.ingredient:
            ingredients_to_process = [args.ingredient]
        elif args.ingredients:
            ingredients_to_process = args.ingredients
        else:
            ingredients_to_process = list(DEFAULT_INGREDIENT_QUERIES.keys())

    print("\n" + "=" * 60)
    print("      COCI YOLO INGREDIENT IMAGE SCRAPER & CLEANER      ")
    print("=" * 60)
    print(f"Output Directory : {output_base.resolve()}")
    print(f"Ingredients      : {', '.join(ingredients_to_process)}")
    print(f"Max Per Query    : {max_num}")
    print(f"Min Dimensions   : {args.min_width}x{args.min_height} px")
    print(f"Crawler Engine   : {args.crawler}")
    print(f"Deduplication    : {'Disabled' if args.skip_dedupe else 'Enabled (Perceptual Hash)'}")
    print("=" * 60)

    summary: Dict[str, int] = {}

    for raw_ingredient_name in ingredients_to_process:
        folder_key = sanitize_folder_name(raw_ingredient_name)
        queries = generate_queries_for_input(raw_ingredient_name)

        ingredient_dir = output_base / folder_key
        raw_dir = ingredient_dir / "raw"
        clean_dir = ingredient_dir / "clean"

        crawl_ingredient_raw(
            ingredient=folder_key,
            queries=queries,
            raw_dir=raw_dir,
            max_num=max_num,
            crawler_name=args.crawler,
        )

        valid_cnt = clean_and_dedupe(
            raw_dir=raw_dir,
            clean_dir=clean_dir,
            ingredient_key=folder_key,
            min_width=args.min_width,
            min_height=args.min_height,
            skip_dedupe=args.skip_dedupe,
        )
        summary[folder_key] = valid_cnt

    print("\n" + "=" * 60)
    print("                 CRAWLING SUMMARY REPORT                 ")
    print("=" * 60)
    for ing_key, count in summary.items():
        clean_path = output_base / ing_key / "clean"
        print(f"  • {ing_key:<20}: {count} clean images -> {clean_path}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
