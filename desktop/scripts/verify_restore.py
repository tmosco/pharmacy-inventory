#!/usr/bin/env python3
"""Day 7: restore a BACKUP into a NEW test file. Never overwrites live data."""
import argparse
from pathlib import Path
import sqlite3


def readonly(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)


def main() -> None:
    parser = argparse.ArgumentParser(description='Restore a backup into a separate test file')
    parser.add_argument('--backup', required=True, type=Path)
    parser.add_argument('--destination', required=True, type=Path)
    parser.add_argument('--product-id', help='Optional known product ID to verify after restore')
    args = parser.parse_args()
    source = args.backup.expanduser().resolve()
    destination = args.destination.expanduser().resolve()
    if not source.is_file():
        parser.error('Backup file not found')
    if destination.exists():
        parser.error('Destination already exists. Refusing to overwrite anything.')
    if source == destination:
        parser.error('Destination cannot equal backup')
    destination.parent.mkdir(parents=True, exist_ok=True)

    with readonly(source) as src:
        with sqlite3.connect(destination) as restored:
            src.backup(restored)
    with readonly(source) as saved, readonly(destination) as restored:
        source_integrity = saved.execute('PRAGMA integrity_check').fetchone()[0]
        restored_integrity = restored.execute('PRAGMA integrity_check').fetchone()[0]
        foreign_errors = restored.execute('PRAGMA foreign_key_check').fetchall()
        if source_integrity != 'ok' or restored_integrity != 'ok' or foreign_errors:
            raise RuntimeError('Restore integrity/foreign-key checks failed')
        tables = [r[0] for r in restored.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
        if 'products' not in tables:
            raise RuntimeError('Products table is missing')
        original_count = saved.execute('SELECT COUNT(*) FROM products').fetchone()[0]
        copied_count = restored.execute('SELECT COUNT(*) FROM products').fetchone()[0]
        if original_count != copied_count:
            raise RuntimeError('Product row count mismatch')
        if args.product_id:
            sql = 'SELECT id, sku, name, status FROM products WHERE id = ?'
            a = saved.execute(sql, (args.product_id,)).fetchone()
            b = restored.execute(sql, (args.product_id,)).fetchone()
            if a is None or b is None or a != b:
                raise RuntimeError('Known product ID does not match or is missing')
        print('Restore test passed:',destination)
        print('Integrity check: ok')
        print('Foreign-key violations: 0')
        print('Products:', copied_count)
        print('Original database was not modified.')


if __name__ == '__main__':
    main()
