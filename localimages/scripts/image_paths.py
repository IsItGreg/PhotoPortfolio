"""Shared paths for flat year folders and optional named folders within a year."""
import re
from pathlib import Path


def valid_photo_key(key):
    if not isinstance(key, str):
        return False
    parts = key.split('/')
    return (len(parts) >= 2 and re.fullmatch(r'[0-9]{4}', parts[0]) is not None
            and all(part and not part.startswith('.') and '\\' not in part
                    and not any(ord(char) < 32 for char in part) for part in parts[1:]))


def library_images(root, extensions=('.webp',)):
    """Yield contained image files, preserving their year/group/filename paths."""
    root = Path(root).resolve()
    if not root.is_dir():
        return
    for path in sorted(root.rglob('*')):
        if path.is_file() and path.suffix.lower() in extensions:
            relative = path.relative_to(root)
            if valid_photo_key(relative.as_posix()) and root in path.resolve().parents:
                yield path
