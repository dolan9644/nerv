#!/usr/bin/env python3
"""
Lock NERV onto a single canonical DB path.

Canonical path:
  ~/.openclaw/nerv/data/db/nerv.db

Compatibility path:
  ~/.openclaw/nerv/data/nerv.db -> symlink to data/db/nerv.db
"""

from __future__ import annotations

import argparse
import filecmp
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from nerv_paths import CANONICAL_DB_PATH, LEGACY_DB_PATH, NERV_ROOT

BACKUP_DIR = NERV_ROOT / 'data' / 'migrations' / 'db_path'


def rel_symlink_target() -> str:
    return os.path.relpath(CANONICAL_DB_PATH, LEGACY_DB_PATH.parent)


def backup_legacy_db() -> str:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup_path = BACKUP_DIR / f'nerv.db.legacy.{stamp}.bak'
    shutil.move(str(LEGACY_DB_PATH), str(backup_path))
    return str(backup_path)


def ensure_layout(fix: bool) -> dict:
    actions = []
    issues = []

    CANONICAL_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    canonical_exists = CANONICAL_DB_PATH.exists()
    legacy_exists = LEGACY_DB_PATH.exists()
    legacy_is_symlink = LEGACY_DB_PATH.is_symlink()

    if legacy_is_symlink:
      # Keep legacy path as compatibility alias.
        current_target = os.path.realpath(LEGACY_DB_PATH)
        canonical_target = os.path.realpath(CANONICAL_DB_PATH) if canonical_exists else str(CANONICAL_DB_PATH)
        if current_target != canonical_target:
            if not fix:
                issues.append({
                    'code': 'LEGACY_SYMLINK_WRONG_TARGET',
                    'message': 'legacy DB symlink does not point to canonical DB path'
                })
            else:
                LEGACY_DB_PATH.unlink()
                LEGACY_DB_PATH.symlink_to(rel_symlink_target())
                actions.append({
                    'action': 'rewire_legacy_symlink',
                    'legacy_db_path': str(LEGACY_DB_PATH),
                    'target': rel_symlink_target()
                })
        return {
            'canonical_db_path': str(CANONICAL_DB_PATH),
            'legacy_db_path': str(LEGACY_DB_PATH),
            'actions': actions,
            'issues': issues
        }

    if legacy_exists and not canonical_exists:
        if fix:
            shutil.move(str(LEGACY_DB_PATH), str(CANONICAL_DB_PATH))
            actions.append({
                'action': 'migrate_legacy_to_canonical',
                'from': str(LEGACY_DB_PATH),
                'to': str(CANONICAL_DB_PATH)
            })
            LEGACY_DB_PATH.symlink_to(rel_symlink_target())
            actions.append({
                'action': 'create_legacy_compat_symlink',
                'legacy_db_path': str(LEGACY_DB_PATH),
                'target': rel_symlink_target()
            })
        else:
            issues.append({
                'code': 'LEGACY_DB_ONLY',
                'message': 'only legacy DB exists; canonical DB path is missing'
            })

    elif canonical_exists and legacy_exists:
        same_content = filecmp.cmp(str(CANONICAL_DB_PATH), str(LEGACY_DB_PATH), shallow=False)
        if fix:
            if not same_content:
                backup_path = backup_legacy_db()
                actions.append({
                    'action': 'backup_drifted_legacy_db',
                    'from': str(LEGACY_DB_PATH),
                    'backup_path': backup_path
                })
            else:
                LEGACY_DB_PATH.unlink()
                actions.append({
                    'action': 'remove_duplicate_legacy_db',
                    'path': str(LEGACY_DB_PATH)
                })
            if LEGACY_DB_PATH.exists() or LEGACY_DB_PATH.is_symlink():
                try:
                    LEGACY_DB_PATH.unlink()
                except FileNotFoundError:
                    pass
            LEGACY_DB_PATH.symlink_to(rel_symlink_target())
            actions.append({
                'action': 'create_legacy_compat_symlink',
                'legacy_db_path': str(LEGACY_DB_PATH),
                'target': rel_symlink_target()
            })
        else:
            issues.append({
                'code': 'DUAL_DB_PATHS',
                'message': 'both canonical and legacy DB files exist as separate files',
                'details': {
                    'same_content': same_content
                }
            })

    elif canonical_exists and not legacy_exists:
        if fix:
            LEGACY_DB_PATH.symlink_to(rel_symlink_target())
            actions.append({
                'action': 'create_legacy_compat_symlink',
                'legacy_db_path': str(LEGACY_DB_PATH),
                'target': rel_symlink_target()
            })
        else:
            issues.append({
                'code': 'LEGACY_COMPAT_SYMLINK_MISSING',
                'message': 'canonical DB exists but legacy compatibility symlink is missing'
            })

    else:
        issues.append({
            'code': 'DB_NOT_INITIALIZED',
            'message': 'no canonical or legacy DB file exists yet'
        })

    return {
        'canonical_db_path': str(CANONICAL_DB_PATH),
        'legacy_db_path': str(LEGACY_DB_PATH),
        'actions': actions,
        'issues': issues
    }


def main() -> None:
    parser = argparse.ArgumentParser(description='Ensure NERV uses a single canonical DB path')
    parser.add_argument('--fix', action='store_true', help='Apply migration/symlink fixes')
    args = parser.parse_args()

    result = ensure_layout(fix=args.fix)
    result['status'] = 'ok' if not result['issues'] else 'warn'
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
