"""Execute the chart's rendered readiness gate against a clock and loopback HTTP."""

import subprocess
import unittest

from support import ROOT


class NamespaceInitTests(unittest.TestCase):
    def test_rendered_api_gate_obeys_readiness_and_time_budgets(self):
        result = subprocess.run(["node", "infra/helm/tests/init-contract.mjs"],
                                cwd=ROOT, text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS rendered API gate", result.stdout)
