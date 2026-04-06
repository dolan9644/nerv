#!/usr/bin/env python3
"""
NERV runtime path helpers.

Single source of truth for canonical runtime paths used by Python scripts.
"""

from __future__ import annotations

import os
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
NERV_ROOT = SCRIPT_DIR.parent
OPENCLAW_ROOT = NERV_ROOT.parent

CANONICAL_DB_PATH = NERV_ROOT / 'data' / 'db' / 'nerv.db'
LEGACY_DB_PATH = NERV_ROOT / 'data' / 'nerv.db'
MEMORY_QUEUE_DIR = NERV_ROOT / 'memory_queue'
SANDBOX_IO_DIR = NERV_ROOT / 'data' / 'sandbox_io'


def get_nerv_db_path() -> str:
    """Return the canonical NERV DB path, optionally overridden by env."""
    override = os.environ.get('NERV_DB_PATH')
    return override or str(CANONICAL_DB_PATH)


def describe_db_layout() -> dict:
    return {
        'canonical_db_path': str(CANONICAL_DB_PATH),
        'legacy_db_path': str(LEGACY_DB_PATH),
        'canonical_exists': CANONICAL_DB_PATH.exists(),
        'legacy_exists': LEGACY_DB_PATH.exists(),
        'legacy_is_symlink': LEGACY_DB_PATH.is_symlink(),
    }
