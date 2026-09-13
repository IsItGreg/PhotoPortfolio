#!/usr/bin/env python3
"""
Convert originals from localimages/jpg/[year]/[optional folder] to WebP.
Preserve the same folders under localimages/webp, with quality 60.
"""

import argparse
import sys
from pathlib import Path
from image_paths import library_images, valid_photo_key

try:
    from PIL import Image
except ImportError:
    print("Pillow is required. Install with: pip install Pillow")
    sys.exit(1)

# Base paths relative to localimages folder
SCRIPT_DIR = Path(__file__).parent
BASE_DIR = SCRIPT_DIR.parent
JPG_DIR = BASE_DIR / "jpg"
WEBP_DIR = BASE_DIR / "webp"

QUALITY = 60


def get_available_years():
    """Get list of year folders in the jpg directory."""
    if not JPG_DIR.exists():
        return []
    return sorted([d.name for d in JPG_DIR.iterdir() if d.is_dir()])


def convert_images(year: str):
    """Convert a year or year/group recursively, skipping existing WebPs."""
    if not valid_photo_key(year + '/placeholder'):
        print('Choose a year or a folder inside a year.')
        return False
    source_dir = (JPG_DIR / year).resolve()
    output_dir = WEBP_DIR / year

    if not source_dir.is_dir() or JPG_DIR.resolve() not in source_dir.parents:
        print(f"Error: Source folder does not exist: {source_dir}")
        return False

    # Create output directory if it doesn't exist
    output_dir.mkdir(parents=True, exist_ok=True)

    # Get all image files
    image_extensions = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"}
    images = [
        f for f in library_images(JPG_DIR, image_extensions)
        if source_dir in f.parents
    ]

    if not images:
        print(f"No images found in {source_dir}")
        return False

    print(f"Converting {len(images)} images from {source_dir}")
    print(f"Output directory: {output_dir}")
    print(f"Quality: {QUALITY}")
    print("-" * 50)

    converted = 0
    skipped = 0
    failed = 0

    for img_path in sorted(images):
        relative = img_path.relative_to(JPG_DIR.resolve())
        output_path = WEBP_DIR / relative.with_suffix('.webp')

        if output_path.exists():
            print(f"Skipping (exists): {img_path.name}")
            skipped += 1
            continue

        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(img_path) as img:
                # Convert to RGB if necessary (for PNG with alpha)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                img.save(output_path, "WEBP", quality=QUALITY)
            print(f"Converted: {img_path.name} -> {output_path.name}")
            converted += 1
        except Exception as e:
            failed += 1
            print(f"Error converting {img_path.name}: {e}")

    print("-" * 50)
    print(f"Done! Converted: {converted}, Skipped: {skipped}, Failed: {failed}")
    return failed == 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', nargs='?', help='Year or year/folder, for example 2026/infrared')
    args = parser.parse_args()
    if args.folder:
        sys.exit(0 if convert_images(args.folder) else 1)
    years = get_available_years()

    if not years:
        print(f"No year folders found in {JPG_DIR}")
        sys.exit(1)

    print("Available years:")
    for i, year in enumerate(years, 1):
        print(f"  {i}. {year}")

    print()
    selection = input("Enter year or number: ").strip()

    # Check if input is a number (index)
    if selection in years:
        year = selection
    elif '/' in selection and valid_photo_key(selection + '/placeholder'):
        year = selection
    elif selection.isdigit():
        idx = int(selection)
        if 1 <= idx <= len(years):
            year = years[idx - 1]
        else:
            print("Invalid selection")
            sys.exit(1)
    else:
        print(f"Year '{selection}' not found")
        sys.exit(1)

    print(f"\nSelected year: {year}")
    sys.exit(0 if convert_images(year) else 1)


if __name__ == "__main__":
    main()
