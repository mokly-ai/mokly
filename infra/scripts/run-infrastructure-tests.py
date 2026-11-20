#!/usr/bin/env python3
"""Run the canonical non-image or storage infrastructure test partition."""

import argparse
from pathlib import Path
import sys
import unittest


ROOT = Path(__file__).resolve().parents[2]
TESTS = ROOT / "infra" / "tests"
STORAGE_MODULE = "test_buildkit_storage"


def selected_modules(selection):
    """Return deterministically assigned infrastructure test modules."""
    modules = sorted(path.stem for path in TESTS.glob("test_*.py"))
    if STORAGE_MODULE not in modules:
        raise RuntimeError(f"missing required storage smoke: {STORAGE_MODULE}.py")
    if selection == "contracts":
        return [module for module in modules if module != STORAGE_MODULE]
    if selection == "storage":
        return [STORAGE_MODULE]
    raise ValueError(f"unknown infrastructure test selection: {selection}")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("selection", choices=("contracts", "storage"))
    return parser.parse_args()


def main():
    selection = parse_args().selection
    sys.path.insert(0, str(TESTS))
    suite = unittest.defaultTestLoader.loadTestsFromNames(
        selected_modules(selection)
    )
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
