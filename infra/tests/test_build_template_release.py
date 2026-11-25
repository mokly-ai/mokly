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
KEY = "e2b_team_key_SECRET"
BUILD_ID = "00000000-0000-4000-8000-000000000001"
STUB_SDK = """
import { writeFileSync } from "node:fs";
const routing = ["E2B_API_URL", "E2B_SANDBOX_URL", "E2B_DOMAIN", "E2B_DEBUG"];
const seen = Object.fromEntries(routing.map((key) => [key, process.env[key] ?? null]));
export class SandboxError extends Error { constructor(message) { super(message); this.name = "SandboxError"; } }
export class AuthenticationError extends Error {}
export class BuildError extends Error {}
export class ServiceBusyError extends Error {}
export function defaultBuildLogger() { return () => {}; }
export function Template() { return { fromDockerfile: (dockerfile) => ({ dockerfile }) }; }
Template.build = async (template, name, options) => {
  const { onBuildLogs, ...connection } = options;
  writeFileSync(process.env.STUB_RECORD, JSON.stringify({ seen, name, template, connection }));
  const mode = process.env.STUB_MODE;
  if (mode === "sdk") throw new TypeError(`Headers.set: "${options.apiKey}" is an invalid header value.`);
  if (mode === "provider") {
    const error = new SandboxError(`401: key ${options.apiKey} is not valid`);
    error.statusCode = 401;
    throw error;
  }
  if (mode === "stray") {
    Promise.reject(new Error(`stray ${options.apiKey}`));
    await new Promise(() => {});
  }
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
        self.receipt = self.template / "e2b.toml"

    def release(self, key=KEY, mode="ok"):
        environment = dict(os.environ, **ROUTING, E2B_API_KEY=key, STUB_MODE=mode,
                           STUB_RECORD=str(self.record))
        result = subprocess.run(
            ["node", str(SCRIPT), str(self.root / "sdk"), str(self.template),
             "mokly-build-v9", "2", "4096"],
            env=environment, capture_output=True, text=True, timeout=30)
        for part in key.split("\n"):
            self.assertNotIn(part, result.stdout + result.stderr)
        return result

    def test_the_team_key_reaches_only_the_fixed_https_api(self):
        result = self.release()
        self.assertEqual(result.returncode, 0, result.stderr)
        record = json.loads(self.record.read_text())
        self.assertEqual(record["seen"], {key: None for key in ROUTING})
        self.assertEqual(record["connection"], {
            "apiKey": KEY, "apiUrl": "https://api.e2b.dev", "debug": False,
            "cpuCount": 2, "memoryMB": 4096})
        self.assertEqual(record["name"], "mokly-build-v9")
        self.assertEqual(record["template"], {"dockerfile": "FROM e2bdev/base\n"})

    def test_the_receipt_names_the_exact_build(self):
        result = self.release()
        self.assertEqual(result.returncode, 0, result.stderr)
        reference = "stub-template:" + BUILD_ID
        self.assertEqual(self.receipt.read_text(), (
            'template_name = "mokly-build-v9"\n'
            'template_id = "stub-template"\n'
            f'build_id = "{BUILD_ID}"\n'
            f'build_reference = "{reference}"\n'))
        self.assertEqual(self.receipt.stat().st_mode & 0o777, 0o600)
        self.assertIn(reference, result.stdout)

    def test_an_existing_receipt_stays_and_no_build_starts(self):
        self.receipt.write_text("build_reference = \"kept:build\"\n")
        result = self.release()
        self.assertEqual(result.returncode, 1)
        self.assertIn("failed to claim the receipt", result.stderr)
        self.assertEqual(self.receipt.read_text(), "build_reference = \"kept:build\"\n")
        self.assertFalse(self.record.exists())

    def test_a_malformed_key_fails_before_the_sdk_with_a_fixed_message(self):
        result = self.release(key="e2b_first_SECRET\ne2b_second_SECRET")
        self.assertEqual(result.returncode, 2)
        self.assertIn("one token of visible ASCII characters", result.stderr)
        self.assertFalse(self.record.exists())
        self.assertFalse(self.receipt.exists())

    def test_failures_keep_the_key_out_and_release_the_claim(self):
        for mode, expected in (
                ("sdk", "failed to build the template: TypeError; details are withheld"),
                ("provider", "failed to build the template: SandboxError (HTTP 401): "
                             "401: key [team key] is not valid"),
                ("stray", "failed to build the template: Error; details are withheld")):
            with self.subTest(mode=mode):
                result = self.release(mode=mode)
                self.assertEqual(result.returncode, 1)
                self.assertIn(expected, result.stderr)
                self.assertFalse(self.receipt.exists())


if __name__ == "__main__":
    unittest.main()
