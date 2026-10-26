//! A source mutation during a Changes-enabled render keeps the installed comparison.

use mokly_test_support::changes;
use mokly_test_support::files::{tree, write};
use mokly_test_support::git::{commit_all, git};

use super::support::{based, mokly};

fn source(mutation: &str) -> String {
    format!(
        "import fs from 'node:fs'; import React from 'react'; import {{defineScreen}} from '@mokly/mokly'; export default defineScreen({{title:'Home',description:'',relatedDocs:[],props:{{}},render(){{{mutation}return React.createElement('p',null,'Home');}}}});"
    )
}

#[test]
fn a_source_mutation_during_a_changes_enabled_render_preserves_the_installed_comparison() {
    let root = based(true);
    let path = root.path();
    write(path, "specs/home.mockup.ts", source(""));
    commit_all(path, "base screen");
    git(path, &["branch", "fixture-base"]);
    let previous = changes::build(&mokly(), path, &[], "rich");
    let snapshot = tree(&previous.output);
    write(
        path,
        "specs/home.mockup.ts",
        source("fs.appendFileSync('specs/home.mockup.ts','\\n// mutated');"),
    );
    let result = mokly()
        .command(path, &["build", "--out=.context/site"], "plain")
        .run();
    assert_eq!(result.code, Some(1), "{}", result.stderr);
    assert!(
        result
            .stderr
            .contains("[mokly/export-invalid] Inputs changed during the build:")
    );
    assert_eq!(tree(&previous.output), snapshot);
}
