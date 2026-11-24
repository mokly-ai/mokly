//! The merged site suite rejects stale, missing, and failed prerequisite output.

use std::fs;

use super::support::{FixtureFactory, TemporaryFixtures, failure, success};

#[test]
fn site_stage_runs_the_complete_gate_and_propagates_output_failures() {
    let fixture = TemporaryFixtures.create();
    fixture.copy("xtask/scripts/strict-command.mjs");
    fixture.write(
        "package.json",
        r#"{
  "private": true,
  "scripts": {
    "build": "node -e \"require('node:fs').writeFileSync('workspace-built', 'ready')\"",
    "site:check": "node scripts/site-check.mjs"
  }
}"#,
    );
    fixture.write(
        "scripts/site-check.mjs",
        r#"import { readFile } from "node:fs/promises";
await readFile("workspace-built", "utf8");
let source;
let output;
try {
  source = await readFile("apps/site/source.html", "utf8");
  output = await readFile("apps/site/dist/index.html", "utf8");
} catch {
  throw new Error("site output missing");
}
if (source !== output) throw new Error("site output stale");
"#,
    );
    fixture.write("apps/site/source.html", "<h1>Current</h1>\n");
    fixture.write("apps/site/dist/index.html", "<h1>Current</h1>\n");
    let args = ["check", "--suite", "cloud-site", "--executor", "local"];
    success(fixture.xtask(&args));
    fixture.write("apps/site/source.html", "<h1>Changed</h1>\n");
    failure(
        fixture.run("npm", &["run", "site:check"]),
        "site output stale",
    );
    failure(fixture.xtask(&args), "npm run site:check");
    fixture.write("apps/site/dist/index.html", "<h1>Changed</h1>\n");
    success(fixture.xtask(&args));
    fs::remove_file(fixture.root().join("apps/site/dist/index.html")).unwrap();
    failure(
        fixture.run("npm", &["run", "site:check"]),
        "site output missing",
    );
    failure(fixture.xtask(&args), "npm run site:check");
}
