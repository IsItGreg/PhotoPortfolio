#!/usr/bin/env python3
"""
Copies all images from webp/[year]/ to public/images/twodim/[year]/,
preserving optional subfolders.
Creates two versions: [name]_full.webp and [name]_small.webp (0.25x scale).
Also generates a manifest.json with image metadata.
"""

import json
import sys
from pathlib import Path
from urllib.parse import quote
from image_paths import library_images
from photo_assets import prepare_photo, jpeg_sources, asset_current

try:
    from PIL import Image
except ImportError:
    print("Pillow is required. Install with: pip install Pillow")
    sys.exit(1)

# Paths
SCRIPT_DIR = Path(__file__).parent
BASE_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = BASE_DIR.parent
WEBP_DIR = BASE_DIR / "webp"
TWODIM_DIR = PROJECT_ROOT / "public" / "images" / "twodim"

# Small image scale factor
SMALL_SCALE = 0.25


def export_image_pair(src_path, dest_dir, base_name):
    """Export full and small versions of an image."""
    with Image.open(src_path) as img:
        # Save full version
        full_path = dest_dir / f"{base_name}_full.webp"
        img.save(full_path, format="WEBP", quality=90)

        # Create and save small version (0.25x scale)
        small_width = max(1, int(img.width * SMALL_SCALE))
        small_height = max(1, int(img.height * SMALL_SCALE))
        small_img = img.resize((small_width, small_height), Image.Resampling.LANCZOS)
        small_path = dest_dir / f"{base_name}_small.webp"
        small_img.save(small_path, format="WEBP", quality=85)

    return full_path, small_path


def generate_manifest():
    """Generate a JSON manifest with image metadata."""
    manifest = []
    for img_path in library_images(TWODIM_DIR):
        if img_path.stem.endswith('_full'):
            relative = img_path.relative_to(TWODIM_DIR.resolve())
            base = relative.with_suffix('').as_posix()[:-5]
            with Image.open(img_path) as img:
                aspect_ratio = img.width / img.height
                manifest.append({
                    'fullUrl': '/images/twodim/' + quote(base, safe='/') + '_full.webp',
                    'smallUrl': '/images/twodim/' + quote(base, safe='/') + '_small.webp',
                    'aspectRatio': round(aspect_ratio, 4), 'vertical': aspect_ratio < 1,
                    'year': relative.parts[0],
                })

    manifest_path = TWODIM_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Generated manifest with {len(manifest)} images")


def main():
    print(f"Source: {WEBP_DIR}")
    print(f"Target: {TWODIM_DIR}")

    if not WEBP_DIR.exists():
        print(f"Error: Source directory does not exist: {WEBP_DIR}")
        sys.exit(1)

    TWODIM_DIR.mkdir(parents=True, exist_ok=True)

    copied = 0
    project_library = WEBP_DIR.resolve() == (PROJECT_ROOT / 'localimages/webp').resolve()
    assets_path = PROJECT_ROOT / 'public/photo-assets.json'
    assets = json.loads(assets_path.read_text()) if project_library and assets_path.exists() else {}
    jpegs = jpeg_sources(PROJECT_ROOT) if project_library else {}
    for img_path in library_images(WEBP_DIR):
        relative = img_path.relative_to(WEBP_DIR.resolve())
        dest_dir = TWODIM_DIR / relative.parent
        dest_dir.mkdir(parents=True, exist_ok=True)
        export_image_pair(img_path, dest_dir, img_path.stem)
        # This command can also be used against a temporary/custom library.
        # Build responsive assets only for the actual project's library.
        if project_library:
            key = relative.with_suffix('').as_posix()
            if not asset_current(PROJECT_ROOT, key, assets.get(key), jpegs):
                assets[key] = prepare_photo(PROJECT_ROOT, key, jpegs=jpegs)
        copied += 1
        print(f"  {relative}")

    print(f"\nCopied {copied} images")
    generate_manifest()
    if project_library and assets:
        assets_path.write_text(json.dumps(assets, separators=(',', ':')) + '\n')


if __name__ == "__main__":
    main()
