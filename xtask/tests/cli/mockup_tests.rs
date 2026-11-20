//! The cloud mockup suite builds real derived output before policy and type checks.

use std::fs;

use super::support::{FixtureFactory, TemporaryFixtures, failure, success};

#[test]
fn mockup_stage_builds_before_checks_and_propagates_real_failures() {
    let fixture = TemporaryFixtures.create();
    fixture.tools();
    fixture.copy("xtask/scripts/strict-command.mjs");
    fixture.write(
        "package.json",
        r#"{
  "private": true,
  "workspaces": ["apps/mockups"],
  "scripts": {
    "build": "node -e \"require('node:fs').writeFileSync('workspace-built', 'ready')\"",
    "mockups:build": "npm run mockups:build --workspace @mokly-cloud/mockups",
    "mockups:check": "npm run mockups:check --workspace @mokly-cloud/mockups",
    "mockups:test": "npm run mockups:test --workspace @mokly-cloud/mockups",
    "mockups:typecheck": "npm run mockups:typecheck --workspace @mokly-cloud/mockups"
  }
}"#,
    );
    fixture.write(
        ".gitignore",
        "target/\nnode_modules\nmokly-static/\n.context/\n.mokly-export-reservations/\n",
    );
    fixture.write("apps/mockups/package.json", r#"{
  "name": "@mokly-cloud/mockups",
  "private": true,
  "scripts": {
    "mockups:build": "node ../../check-workspace.mjs && mokly build --config ../../mokly.config.json --strict --no-changes",
    "mockups:check": "mokly build --config ../../mokly.config.json --strict --no-changes --out .context/mockups-check",
    "mockups:test": "node --test ../../tests/policy.test.mjs",
    "mockups:typecheck": "tsc --project ../../tsconfig.json"
  }
}"#);
    fixture.write(
        "check-workspace.mjs",
        "import { readFileSync } from 'node:fs';\nreadFileSync('../../workspace-built');\n",
    );
    fixture.write("mokly.config.json", r#"{"repoRoot":".","roots":[{"dir":"entries","files":["**/*.mockup.{ts,tsx}"]}],"moduleResolution":{"packageRoots":["."]}}"#);
    fixture.write("entries/screen.mockup.tsx", "import { defineScreen } from '@mokly/mokly';\nexport const screen = defineScreen({ title: 'Screen', description: 'Fixture', relatedDocs: [], render: (_, context) => <main>{context.viewport}</main> });\n");
    fixture.write("tsconfig.json", r#"{"compilerOptions":{"strict":true,"noEmit":true,"types":[],"ignoreDeprecations":"6.0"},"files":["fixture.ts"]}"#);
    fixture.write("fixture.ts", "export const value: number = 1;\n");
    let policy = "import { readFileSync } from 'node:fs';\nimport { test } from 'node:test';\nimport assert from 'node:assert/strict';\ntest('policy', () => assert.equal(1, 1));\ntest('fresh output', () => assert.ok(!readFileSync(new URL('../mokly-static/static/mokly-generated/screen/index.mobile.html', import.meta.url), 'utf8').includes('stale')));\n";
    fixture.write("tests/policy.test.mjs", policy);
    let args = ["check", "--suite", "cloud-mockups", "--executor", "local"];
    success(fixture.xtask(&args));
    let path = "mokly-static/static/mokly-generated/screen/index.mobile.html";
    let generated = fs::read_to_string(fixture.root().join(path)).unwrap();
    fixture.write(path, &(generated + "stale\n"));
    success(fixture.xtask(&args));
    assert!(
        !fs::read_to_string(fixture.root().join(path))
            .unwrap()
            .contains("stale")
    );
    fixture.baseline();
    assert!(
        success(fixture.run(
            "git",
            &[
                "ls-files",
                "--",
                "mokly-static",
                ".mokly-export-reservations",
                ".context"
            ]
        ))
        .is_empty()
    );
    fixture.write("tests/policy.test.mjs", &policy.replace("1, 1", "1, 2"));
    failure(fixture.run("npm", &["run", "mockups:test"]), "policy");
    failure(fixture.xtask(&args), "npm run mockups:test");
    fixture.write("tests/policy.test.mjs", policy);
    fixture.write("fixture.ts", "export const value: number = 'wrong';\n");
    failure(fixture.run("npm", &["run", "mockups:typecheck"]), "TS2322");
    failure(fixture.xtask(&args), "npm run mockups:typecheck");
    fixture.write("fixture.ts", "export const value: number = 1;\n");
    fixture.write(
        "entries/screen.mockup.tsx",
        "export const screen = <main>;\n",
    );
    failure(
        fixture.run("npm", &["run", "mockups:build"]),
        "build-invalid",
    );
    failure(fixture.xtask(&args), "npm run mockups:build");
}
