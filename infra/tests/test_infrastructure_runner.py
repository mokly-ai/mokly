"""Infrastructure test files stay assigned to a canonical hosted partition."""

import importlib.util
from pathlib import Path
import unittest

from support import ROOT


RUNNER_PATH = ROOT / "infra" / "scripts" / "run-infrastructure-tests.py"
SPEC = importlib.util.spec_from_file_location("infrastructure_test_runner", RUNNER_PATH)
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)


class InfrastructureRunnerTests(unittest.TestCase):
    def test_contracts_and_storage_assign_every_test_file_once(self):
        all_modules = {
            path.stem for path in Path(ROOT, "infra", "tests").glob("test_*.py")
        }
        contracts = set(RUNNER.selected_modules("contracts"))
        storage = set(RUNNER.selected_modules("storage"))

        self.assertEqual(storage, {"test_buildkit_storage"})
        self.assertEqual(contracts | storage, all_modules)
        self.assertFalse(contracts & storage)

    def test_template_assertions_and_build_delivery_run_in_contracts(self):
        contracts = RUNNER.selected_modules("contracts")
        self.assertIn("test_build_template", contracts)
        self.assertIn("test_build_values", contracts)


if __name__ == "__main__":
    unittest.main()
