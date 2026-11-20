"""Load repository scripts without installing a runtime package."""

import importlib.util
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "infra/scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


def load(name):
    module_name = name.replace("-", "_")
    spec = importlib.util.spec_from_file_location(module_name, ROOT / "infra/scripts" / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module
