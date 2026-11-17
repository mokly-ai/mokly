//! Real npm scripts reject lock drift, formatting, lint, types, and shell failures.

use std::fs;

use serde_json::Value;

use super::support::{Fixture, FixtureFactory, TemporaryFixtures, failure, repository, success};

fn scripts(fixture: &dyn Fixture, names: &[&str], workspaces: &[&str]) {
    let source: Value =
        serde_json::from_str(&fs::read_to_string(repository().join("package.json")).unwrap())
            .unwrap();
    let mut manifest = serde_json::json!({
        "private": true, "type": "module", "scripts": {}, "workspaces": workspaces,
    });
    for name in names {
        manifest["scripts"][name] = source["scripts"][name].clone();
    }
    fixture.write(
        "package.json",
        &serde_json::to_string_pretty(&manifest).unwrap(),
    );
}

#[test]
fn npm_ci_stage_rejects_manifest_lock_disagreement() {
    let fixture = TemporaryFixtures.create();
    fixture.write(
        "package.json",
        r#"{"name":"fixture","version":"1.0.0","private":true}"#,
    );
    success(fixture.run(
        "npm",
        &[
            "install",
            "--package-lock-only",
            "--ignore-scripts",
            "--offline",
        ],
    ));
    success(fixture.run("npm", &["ci"]));
    fixture.write(
        "package.json",
        r#"{"name":"fixture","version":"1.0.0","private":true,"workspaces":["apps/app"]}"#,
    );
    fixture.write(
        "apps/app/package.json",
        r#"{"name":"missing-workspace","version":"1.0.0"}"#,
    );
    failure(fixture.run("npm", &["ci"]), "Missing:");
}

#[test]
fn prettier_stage_rejects_unformatted_markdown() {
    let fixture = TemporaryFixtures.create();
    scripts(fixture.as_ref(), &["format:check"], &[]);
    fixture.copy(".prettierrc.json");
    fixture.copy(".prettierignore");
    fixture.tools();
    success(fixture.run("npx", &["--no-install", "prettier", "--write", "."]));
    success(fixture.run("npm", &["run", "format:check"]));
    fixture.write("bad.md", "# Title\n\n-   misplaced spacing\n");
    failure(
        fixture.run("npm", &["run", "format:check"]),
        "Code style issues",
    );
}

#[test]
fn eslint_stage_rejects_unused_typescript() {
    let fixture = TemporaryFixtures.create();
    scripts(fixture.as_ref(), &["lint"], &[]);
    fixture.copy("eslint.config.js");
    fixture.copy("apps/eslint-rules.mjs");
    fixture.copy_tree("scripts/eslint");
    fixture.tools();
    fixture.write("apps/app/src/index.ts", "export const ready = true;\n");
    success(fixture.run("npm", &["run", "lint"]));
    fixture.write("apps/app/src/failure.ts", "const unused = 1;\n");
    failure(
        fixture.run("npm", &["run", "lint"]),
        "@typescript-eslint/no-unused-vars",
    );
}

#[test]
fn typecheck_stage_rejects_invalid_types_in_every_workspace() {
    let fixture = TemporaryFixtures.create();
    let workspaces = [
        "packages/tokens",
        "apps/app",
        "apps/desktop",
        "apps/mockups",
        "apps/site",
        "apps/worker",
    ];
    scripts(fixture.as_ref(), &["cloud:typecheck"], &workspaces);
    fixture.tools();
    for path in workspaces {
        fixture.write(&format!("{path}/package.json"), &format!(r#"{{"name":"fixture-{}","private":true,"scripts":{{"typecheck":"tsc --noEmit"}}}}"#, path.replace('/', "-")));
        fixture.write(&format!("{path}/tsconfig.json"), r#"{"compilerOptions":{"strict":true,"types":[],"ignoreDeprecations":"6.0"},"include":["src"]}"#);
        fixture.write(
            &format!("{path}/src/index.ts"),
            "export const ready = true;\n",
        );
    }
    success(fixture.run("npm", &["run", "cloud:typecheck"]));
    for path in workspaces {
        fixture.write(
            &format!("{path}/src/failure.ts"),
            "export const broken: number = 'wrong';\n",
        );
    }
    let output = fixture.run("npm", &["run", "cloud:typecheck"]);
    let diagnostics = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    failure(output, "TS2322");
    assert_eq!(
        diagnostics.matches("error TS2322").count(),
        workspaces.len(),
        "{diagnostics}"
    );
    for path in workspaces {
        let name = path.replace('/', "-");
        assert!(
            diagnostics.contains(&format!("npm error workspace fixture-{name}")),
            "{path}: {diagnostics}"
        );
    }
}

#[test]
fn origin_router_stage_rejects_a_failing_worker_fixture() {
    let fixture = TemporaryFixtures.create();
    fixture.tools();
    fixture.write(
        "package.json",
        r#"{"private":true,"workspaces":["apps/worker"]}"#,
    );
    fixture.copy("apps/worker/package.json");
    fixture.write("apps/worker/tsconfig.json", r#"{"compilerOptions":{"strict":true,"types":[],"ignoreDeprecations":"6.0"},"include":["src"]}"#);
    fixture.write("apps/worker/src/index.ts", "export const ready = true;\n");
    success(fixture.run(
        "npm",
        &["run", "typecheck", "--workspace", "@mokly-cloud/worker"],
    ));
    fixture.write(
        "apps/worker/src/failure.ts",
        "export const broken: number = 'wrong';\n",
    );
    failure(
        fixture.run(
            "npm",
            &["run", "typecheck", "--workspace", "@mokly-cloud/worker"],
        ),
        "TS2322",
    );
}

#[test]
fn desktop_stage_propagates_a_real_shell_test_failure() {
    let fixture = TemporaryFixtures.create();
    fixture.tools();
    fixture.write(
        "package.json",
        r#"{"private":true,"workspaces":["apps/desktop"]}"#,
    );
    fixture.copy("apps/desktop/package.json");
    fixture.write("apps/desktop/src/_tests_/failure.test.ts", "import assert from 'node:assert/strict';\nimport test from 'node:test';\ntest('desktop rejection fixture', () => assert.equal(1, 2));\n");
    failure(
        fixture.run("npm", &["test", "--workspace", "@mokly-cloud/desktop"]),
        "desktop rejection fixture",
    );
}
