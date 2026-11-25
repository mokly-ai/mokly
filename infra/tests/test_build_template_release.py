"""Local checks of the template release script against a stub E2B SDK; no provider access."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from support import ROOT


SCRIPT = ROOT / "infra/e2b/build/build-template.mjs"
ROUTING = {
    "E2B_API_URL": "http://127.0.0.1:9/attacker",
    "E2B_SANDBOX_URL": "http://127.0.0.1:9/sandbox",
    "E2B_DOMAIN": "attacker.example",
    "E2B_DEBUG": "true",
}
BUILD_ID = "00000000-0000-4000-8000-000000000001"
STUB_SDK = """
import { writeFileSync } from "node:fs";
const routing = ["E2B_API_URL", "E2B_SANDBOX_URL", "E2B_DOMAIN", "E2B_DEBUG"];
const seen = Object.fromEntries(routing.map((key) => [key, process.env[key] ?? null]));
export function defaultBuildLogger() { return () => {}; }
export function Template() { return { fromDockerfile: (dockerfile) => ({ dockerfile }) }; }
Template.build = async (template, name, options) => {
  const { onBuildLogs, ...connection } = options;
  writeFileSync(process.env.STUB_RECORD, JSON.stringify({ seen, name, template, connection }));
  return { name, templateId: "stub-template", buildId: "%s" };
};
""" % BUILD_ID


class BuildTemplateReleaseTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        sdk = self.root / "sdk/node_modules/e2b/dist"
        sdk.mkdir(parents=True)
        (sdk / "index.mjs").write_text(STUB_SDK)
        self.template = self.root / "candidate"
        self.template.mkdir()
        (self.template / "e2b.Dockerfile").write_text("FROM e2bdev/base\n")
        self.record = self.root / "record.json"

    def release(self):
        environment = dict(os.environ, **ROUTING, E2B_API_KEY="team-key",
                           STUB_RECORD=str(self.record))
        return subprocess.run(
            ["node", str(SCRIPT), str(self.root / "sdk"), str(self.template),
             "mokly-build-v9", "2", "4096"],
            env=environment, capture_output=True, text=True, timeout=30)

    def test_the_team_key_reaches_only_the_fixed_https_api(self):
        result = self.release()
        self.assertEqual(result.returncode, 0, result.stderr)
        record = json.loads(self.record.read_text())
        self.assertEqual(record["seen"], {key: None for key in ROUTING})
        self.assertEqual(record["connection"], {
            "apiKey": "team-key", "apiUrl": "https://api.e2b.dev", "debug": False,
            "cpuCount": 2, "memoryMB": 4096})
        self.assertEqual(record["name"], "mokly-build-v9")
        self.assertEqual(record["template"], {"dockerfile": "FROM e2bdev/base\n"})

    def test_the_receipt_names_the_exact_build(self):
        result = self.release()
        self.assertEqual(result.returncode, 0, result.stderr)
        reference = "stub-template:" + BUILD_ID
        self.assertEqual((self.template / "e2b.toml").read_text(), (
            'template_name = "mokly-build-v9"\n'
            'template_id = "stub-template"\n'
            f'build_id = "{BUILD_ID}"\n'
            f'build_reference = "{reference}"\n'))
        self.assertEqual(self.template.joinpath("e2b.toml").stat().st_mode & 0o777, 0o600)
        self.assertIn(reference, result.stdout)


if __name__ == "__main__":
    unittest.main()
