#!/usr/bin/env python3
"""
Web-based GUI tool to select images for the threedimbox folder.
Displays a scrollable grid of thumbnails from webp/[year]/ folders,
allows selection via checkboxes, and syncs to public/images/threedimbox.
"""

import base64
import http.server
import io
import json
import os
import socketserver
import sys
import threading
import webbrowser
from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.parse import quote
from image_paths import library_images

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
THREEDIMBOX_DIR = PROJECT_ROOT / "public" / "images" / "threedimbox"

# Thumbnail settings
THUMB_SIZE = (150, 150)

# Border settings for exported images
RESIZE_SCALE = 0.25  # reduce dimensions by 50%
BORDER_SIZE = 50  # pixels on each side
BORDER_COLOR = (255, 255, 255)  # white

PORT = 8765


def get_existing_images():
    """Get set of year/filename pairs already in threedimbox."""
    existing = set()
    if not THREEDIMBOX_DIR.exists():
        return existing
    for img in library_images(THREEDIMBOX_DIR):
        existing.add(img.relative_to(THREEDIMBOX_DIR.resolve()).as_posix())
    return existing


def get_all_webp_images():
    """Get all webp images from year folders, grouped by year."""
    images_by_year = {}
    if not WEBP_DIR.exists():
        return images_by_year

    for img_path in library_images(WEBP_DIR):
        relative = img_path.relative_to(WEBP_DIR.resolve())
        year = relative.parts[0]
        images_by_year.setdefault(year, []).append({
            'year': year, 'group': '/'.join(relative.parts[1:-1]),
            'path': str(img_path), 'name': img_path.name, 'key': relative.as_posix(),
        })

    return images_by_year


def create_thumbnail_base64(img_path):
    """Create a base64-encoded thumbnail for the given image path."""
    try:
        with Image.open(img_path) as img:
            img.thumbnail(THUMB_SIZE, Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            img.save(buffer, format="WEBP", quality=80)
            return base64.b64encode(buffer.getvalue()).decode("utf-8")
    except Exception as e:
        print(f"Error creating thumbnail for {img_path}: {e}")
        return None


@lru_cache(maxsize=256)
def thumbnail_bytes(img_path, modified):
    """Cache only the small preview, refreshing when its source changes."""
    data = create_thumbnail_base64(img_path)
    return base64.b64decode(data) if data else None


def add_white_border(img_path, dest_path):
    """Resize image by 50%, add a white border, and save to destination."""
    with Image.open(img_path) as img:
        # Resize to 50% of original dimensions
        resized_width = int(img.width * RESIZE_SCALE)
        resized_height = int(img.height * RESIZE_SCALE)
        resized = img.resize((resized_width, resized_height), Image.Resampling.LANCZOS)

        # Add white border
        new_width = resized_width + (BORDER_SIZE * 2)
        new_height = resized_height + (BORDER_SIZE * 2)
        bordered = Image.new("RGB", (new_width, new_height), BORDER_COLOR)
        bordered.paste(resized, (BORDER_SIZE, BORDER_SIZE))
        bordered.save(dest_path, format="WEBP", quality=90)
    return dest_path


def generate_manifest():
    """Generate a JSON manifest with image metadata including aspect ratios."""
    manifest = []
    if not THREEDIMBOX_DIR.exists():
        return

    for img_path in library_images(THREEDIMBOX_DIR):
        relative = img_path.relative_to(THREEDIMBOX_DIR.resolve()).as_posix()
        try:
            with Image.open(img_path) as img:
                aspect_ratio = img.width / img.height
                manifest.append({
                    'url': '/images/threedimbox/' + quote(relative, safe='/'),
                    'aspectRatio': round(aspect_ratio, 4), 'vertical': aspect_ratio < 1,
                })
        except Exception as e:
            print(f'Error reading {img_path}: {e}')

    manifest_path = THREEDIMBOX_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Generated manifest with {len(manifest)} images at {manifest_path}")


def apply_selection(selected_keys):
    """Sync selection to threedimbox folder with year subfolders."""
    selected_set = set(selected_keys)

    # Ensure threedimbox directory exists
    THREEDIMBOX_DIR.mkdir(parents=True, exist_ok=True)

    # Get current files in threedimbox
    existing = get_existing_images()

    # Build path lookup from all images
    images_by_year = get_all_webp_images()
    path_lookup = {}
    for year, images in images_by_year.items():
        for img in images:
            path_lookup[img["key"]] = Path(img["path"])

    # Files to copy (selected but not in threedimbox)
    to_copy = [key for key in selected_set if key not in existing and key in path_lookup]

    # Files to remove (in threedimbox but not selected)
    to_remove = [key for key in existing if key not in selected_set]

    # Copy new files with white border added
    copied = 0
    for key in to_copy:
        try:
            destination = THREEDIMBOX_DIR / key
            dest_dir = destination.parent
            dest_dir.mkdir(parents=True, exist_ok=True)
            add_white_border(path_lookup[key], destination)
            copied += 1
        except Exception as e:
            print(f"Error copying {key}: {e}")

    # Remove deselected files
    removed = 0
    for key in to_remove:
        try:
            year, name = key.split("/", 1)
            (THREEDIMBOX_DIR / year / name).unlink()
            removed += 1
            # Remove year folder if empty
            year_dir = THREEDIMBOX_DIR / year
            if year_dir.exists() and not any(year_dir.iterdir()):
                year_dir.rmdir()
        except Exception as e:
            print(f"Error removing {key}: {e}")

    # Generate manifest after syncing files
    generate_manifest()

    return {"copied": copied, "removed": removed, "no_change": not to_copy and not to_remove}


HTML_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ThreeDimBox Image Selector</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: #fff;
        }
        .header {
            position: sticky;
            top: 0;
            background: #1a1a1a;
            padding: 10px 0 20px 0;
            z-index: 100;
            border-bottom: 1px solid #333;
            margin-bottom: 20px;
        }
        .controls {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        button {
            padding: 10px 20px;
            font-size: 14px;
            cursor: pointer;
            border: none;
            border-radius: 6px;
            background: #333;
            color: #fff;
            transition: background 0.2s;
        }
        button:hover { background: #444; }
        button.apply {
            background: #2563eb;
        }
        button.apply:hover { background: #1d4ed8; }
        .status {
            margin-left: auto;
            font-size: 14px;
            color: #888;
        }
        .year-section {
            margin-bottom: 30px;
        }
        .year-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #444;
        }
        .year-title {
            font-size: 24px;
            font-weight: 600;
            color: #fff;
        }
        .year-count {
            font-size: 14px;
            color: #888;
        }
        .year-buttons {
            margin-left: auto;
            display: flex;
            gap: 8px;
        }
        .year-buttons button {
            padding: 6px 12px;
            font-size: 12px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
            gap: 15px;
        }
        .group-title {
            margin: 24px 0 12px;
            font-size: 16px;
            font-weight: 500;
            color: #bbb;
        }
        .card {
            background: #252525;
            border-radius: 8px;
            padding: 10px;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            cursor: pointer;
        }
        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .card.selected {
            outline: 3px solid #2563eb;
        }
        .card img {
            max-width: 150px;
            max-height: 150px;
            border-radius: 4px;
        }
        .card .name {
            font-size: 12px;
            color: #ccc;
            margin-top: 4px;
            word-break: break-all;
        }
        .card input[type="checkbox"] {
            width: 18px;
            height: 18px;
            margin-top: 8px;
            cursor: pointer;
        }
        .message {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: #22c55e;
            color: #fff;
            border-radius: 8px;
            display: none;
            z-index: 200;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="controls">
            <button onclick="selectAll()">Select All</button>
            <button onclick="deselectAll()">Deselect All</button>
            <button class="apply" onclick="applySelection()">Apply</button>
            <span class="status" id="status">Loading...</span>
        </div>
    </div>
    <div id="container"></div>
    <div class="message" id="message"></div>

    <script>
        let imagesByYear = {};
        let selected = new Set();

        async function loadImages() {
            const resp = await fetch('/api/images');
            const data = await resp.json();
            imagesByYear = data.images_by_year;
            selected = new Set(data.existing);
            renderGrid();
            updateStatus();
        }

        const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

        function renderGroup(group, images) {
            return `
                <h3 class="group-title">${escapeHtml(group || 'Ungrouped photos')} · ${images.length} photos</h3>
                <div class="grid">
                    ${images.map(img => `
                        <div class="card ${selected.has(img.key) ? 'selected' : ''}" data-key="${escapeHtml(img.key)}">
                            <img loading="lazy" src="/api/thumbnail?key=${encodeURIComponent(img.key)}" alt="${escapeHtml(img.name)}">
                            <div class="name" title="${escapeHtml(img.key)}">${escapeHtml(img.name)}</div>
                            <input aria-label="Select ${escapeHtml(img.key)}" type="checkbox" ${selected.has(img.key) ? 'checked' : ''}>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        function renderGrid() {
            const container = document.getElementById('container');
            const years = Object.keys(imagesByYear).sort().reverse();

            container.innerHTML = years.map(year => {
                const images = imagesByYear[year];
                const selectedInYear = images.filter(img => selected.has(img.key)).length;
                const groups = [...new Set(images.map(img => img.group || ''))].sort();
                return `
                    <div class="year-section" data-year="${year}">
                        <div class="year-header">
                            <span class="year-title">${year}</span>
                            <span class="year-count">${selectedInYear} / ${images.length} selected</span>
                            <div class="year-buttons">
                                <button onclick="selectYear('${year}')">Select All</button>
                                <button onclick="deselectYear('${year}')">Deselect All</button>
                            </div>
                        </div>
                        ${groups.map(group => renderGroup(group, images.filter(img => (img.group || '') === group))).join('')}
                    </div>
                `;
            }).join('');
            container.querySelectorAll('.card').forEach(card => {
                card.addEventListener('click', () => toggleSelect(card.dataset.key, card));
            });
        }

        function toggleSelect(key, card) {
            if (selected.has(key)) {
                selected.delete(key);
                card.classList.remove('selected');
                card.querySelector('input').checked = false;
            } else {
                selected.add(key);
                card.classList.add('selected');
                card.querySelector('input').checked = true;
            }
            updateStatus();
            updateYearCount(key.split('/')[0]);
        }

        function updateYearCount(year) {
            const section = document.querySelector(`.year-section[data-year="${year}"]`);
            if (section) {
                const images = imagesByYear[year];
                const selectedInYear = images.filter(img => selected.has(img.key)).length;
                section.querySelector('.year-count').textContent = `${selectedInYear} / ${images.length} selected`;
            }
        }

        function selectYear(year) {
            imagesByYear[year].forEach(img => selected.add(img.key));
            renderGrid();
            updateStatus();
        }

        function deselectYear(year) {
            imagesByYear[year].forEach(img => selected.delete(img.key));
            renderGrid();
            updateStatus();
        }

        function selectAll() {
            Object.values(imagesByYear).flat().forEach(img => selected.add(img.key));
            renderGrid();
            updateStatus();
        }

        function deselectAll() {
            selected.clear();
            renderGrid();
            updateStatus();
        }

        function getTotalCount() {
            return Object.values(imagesByYear).flat().length;
        }

        function updateStatus() {
            document.getElementById('status').textContent = `Selected: ${selected.size} / ${getTotalCount()}`;
        }

        async function applySelection() {
            const resp = await fetch('/api/apply', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({selected: Array.from(selected)})
            });
            const result = await resp.json();
            const msg = document.getElementById('message');
            if (result.no_change) {
                msg.textContent = 'No changes needed';
                msg.style.background = '#666';
            } else {
                msg.textContent = `Copied: ${result.copied}, Removed: ${result.removed}`;
                msg.style.background = '#22c55e';
            }
            msg.style.display = 'block';
            setTimeout(() => msg.style.display = 'none', 3000);
        }

        loadImages();
    </script>
</body>
</html>
"""


class RequestHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress logging

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_TEMPLATE.encode())

        elif url.path == "/api/images":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()

            images_by_year = get_all_webp_images()
            existing = get_existing_images()

            response = {"images_by_year": images_by_year, "existing": list(existing)}
            self.wfile.write(json.dumps(response).encode())

        elif url.path == '/api/thumbnail':
            key = parse_qs(url.query).get('key', [''])[0]
            source = next((Path(img['path']) for images in get_all_webp_images().values()
                           for img in images if img['key'] == key), None)
            data = thumbnail_bytes(str(source), source.stat().st_mtime_ns) if source else None
            if data is None:
                self.send_error(404, 'Image not found')
                return
            self.send_response(200)
            self.send_header('Content-Type', 'image/webp')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == "/api/apply":
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode())

            result = apply_selection(data.get("selected", []))

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        else:
            self.send_error(404)


def main():
    print(f"Source: {WEBP_DIR}")
    print(f"Target: {THREEDIMBOX_DIR}")
    print(f"Starting server at http://localhost:{PORT}")

    # Allow address reuse
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", PORT), RequestHandler) as httpd:
        # Open browser after short delay
        def open_browser():
            webbrowser.open(f"http://localhost:{PORT}")

        threading.Timer(0.5, open_browser).start()

        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")


if __name__ == "__main__":
    main()
