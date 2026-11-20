//! Imported ast-grep controls still reject violations in their merged scopes.

use std::process::Output;

use super::support::{Fixture, FixtureFactory, TemporaryFixtures, failure, success};

fn scan(fixture: &dyn Fixture) -> Output {
    fixture.run(
        "npx",
        &[
            "--no-install",
            "ast-grep",
            "scan",
            "crates",
            "xtask",
            "packages",
            "apps",
        ],
    )
}

fn prepare(fixture: &dyn Fixture) {
    fixture.tools();
    fixture.copy("sgconfig.yml");
    fixture.copy_tree("rules");
    for path in [
        "crates/mkc-fixture/src/lib.rs",
        "xtask/valid.rs",
        "packages/valid.ts",
        "packages/app/src/valid.ts",
    ] {
        fixture.write(path, "");
    }
}

#[test]
fn ast_grep_stage_rejects_all_required_import_violations() {
    let fixture = TemporaryFixtures.create();
    prepare(fixture.as_ref());
    fixture.write("crates/mkc-fixture/src/lib.rs", "use std::fmt;\n");
    fixture.write("xtask/valid.rs", "use crate::error::Error;\n");
    success(scan(fixture.as_ref()));
    for (source, reason) in [
        ("fn run() { use std::fmt; }\n", "no-inline-use"),
        (
            "fn run() { crate::error::run(); }\n",
            "prefer-imports-over-crate-paths",
        ),
        ("fn run() {}\nuse crate::error::Error;\n", "no-late-use"),
    ] {
        fixture.write("crates/mkc-fixture/src/lib.rs", source);
        failure(scan(fixture.as_ref()), reason);
    }
}

#[test]
fn ast_grep_stage_rejects_a_control_that_answers_for_its_write() {
    let fixture = TemporaryFixtures.create();
    prepare(fixture.as_ref());
    let pane = "packages/app/src/settings/panes/example.tsx";
    fixture.write(
        pane,
        "export const Pane = () => <Action disabled={withdraw.disabled} />;\n",
    );
    success(scan(fixture.as_ref()));
    fixture.write(
        pane,
        "export const Pane = () => <Action disabled={withdraw.pending} />;\n",
    );
    failure(scan(fixture.as_ref()), "derive-disabled-from-write");
    fixture.write(
        pane,
        "export const Pane = () => <Action disabled={removal.disabled || rename.pending} />;\n",
    );
    success(scan(fixture.as_ref()));
}
