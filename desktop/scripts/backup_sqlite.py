#!/usr/bin/env python3
"""Day 7: non-destructive, SQLite-consistent backup from an explicit path.

Does NOT delete, overwrite, or change the original database.
Close the application first for a straightforward maintenance workflow.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import sqlite3
import sys


def readonly(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)


def checks(db: sqlite3.Connection) -> dict:
    integrity = db.execute('PRAGMA integrity_check').fetchone()[0]
    foreign_violations = db.execute('PRAGMA foreign_key_check').fetchall()
    tables = [row[0] for row in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )]
    products = None
    if 'products' in tables:
        products = db.execute('SELECT COUNT(*) FROM products').fetchone()[0]
    return dict(integrity_check=integrity,
                foreign_key_violations=len(foreign_violations),
                tables=tables, product_count=products)


def main() -> int:
    parser = argparse.ArgumentParser(description='Create and verify a new SQLite backup')
    parser.add_argument('--source', required=True, type=Path,
                        help='Exact file path from PRAGMA database_list')
    parser.add_argument('--output-dir', required=True, type=Path,
                        help='Different directory for backup output')
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    folder = args.output_dir.expanduser().resolve()
    if not source.is_file():
        parser.error(f'Source file does not exist: {source}')
    if folder == source.parent:
        parser.error('Choose a separate directory from the live database')
    folder.mkdir(parents=True, exist_ok=True)

    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    output = folder / f'{source.stem}-backup-{stamp}.sqlite3'
    if output.exists():
        parser.error(f'Refusing to overwrite backup: {output}')

    src = readonly(source)
    try:
        with sqlite3.connect(output) as dest:
            src.backup(dest)   # SQLite-consistent snapshot, including WAL content.
        with readonly(output) as check:
            result = checks(check)
        if result['integrity_check'] != 'ok' or result['foreign_key_violations']:
            raise RuntimeError(f'Backup failed integrity checks: {result}')
        sha256 = hashlib.sha256(output.read_bytes()).hexdigest()
        metadata = {
            'created_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
            'source_filename': source.name,  # Avoid exposing full path in metadata.
            'backup_filename': output.name,
            'sha256': sha256,
            'sqlite_version': sqlite3.sqlite_version,
            **result,
        }
        output.with_suffix('.json').write_text(json.dumps(metadata,indent=2) + '\n')
        print('Backup created:', output)
        print('Integrity:', result['integrity_check'])
        print('Foreign-key violations:', result['foreign_key_violations'])
        print('Product records:', result['product_count'])
        return 0
    except Exception:
        if output.exists():
            print(f'Backup output may be incomplete; inspect before use: {output}',file=sys.stderr)
        raise
    finally:
        src.close()


if __name__ == '__main__':
    raise SystemExit(main())
