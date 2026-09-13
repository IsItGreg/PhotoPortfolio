#!/usr/bin/env python3
"""Prepare only explicitly public photos; optionally filter/verify build output."""
import argparse
import fcntl
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'localimages/scripts'))
from publication import publish, verify_build

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--build', action='store_true')
parser.add_argument('--check-build', action='store_true')
args = parser.parse_args()
lock_path = ROOT / '.cache/photo-publication.lock'
lock_path.parent.mkdir(parents=True, exist_ok=True)
with lock_path.open('a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    if args.check_build:
        verify_build(ROOT)
    else:
        print(json.dumps(publish(ROOT, ROOT / ('build' if args.build else 'public'), prepare=not args.build), indent=2))
