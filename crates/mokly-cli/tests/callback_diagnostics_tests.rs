//! Page callback warnings print and strict builds preserve the earlier output.

use std::fs;

mod diagnostic_support;

use diagnostic_support::fixture::{Fixture, fixture, write};

fn run(root: &Fixture, strict: bool) -> std::process::Output {
    let mut command = root.command();
    command.args(["build", "--no-changes", "--out", "site"]);
    if strict {
        command.arg("--strict");
    }
    command.output().unwrap()
}

#[test]
fn page_callback_warnings_print_and_strict_keeps_existing_output() {
    let root = fixture();
    write(
        root.path(),
        "specs/statement.mockup.ts",
        "import {definePage} from '@mokly/mokly'; export default definePage({title:'Statement',description:'',relatedDocs:[],render:()=> '<!doctype html><html><head></head><body><mokly-ignore-scope enabled=\"true\" typo=\"x\"><mokly-ignore id=\"clock\" extra=\"y\" class=\"z\">Clock</mokly-ignore></mokly-ignore-scope></body></html>'});",
    );
    let plain = run(&root, false);
    assert_eq!(plain.status.code(), Some(0));
    let expected = "[mokly/warning] entry \"statement\": unknown attribute class on <mokly-ignore> is ignored\n[mokly/warning] entry \"statement\": unknown attribute extra on <mokly-ignore> is ignored\n[mokly/warning] entry \"statement\": unknown attribute typo on <mokly-ignore-scope> is ignored\n";
    assert_eq!(String::from_utf8(plain.stderr).unwrap(), expected);
    let index = fs::read(root.path().join("site/mokly-viewer/index.json")).unwrap();
    let marker = fs::read(root.path().join("site/.mokly-export-artifact")).unwrap();

    let strict = run(&root, true);
    assert_eq!(strict.status.code(), Some(1));
    assert!(strict.stdout.is_empty());
    assert_eq!(
        String::from_utf8(strict.stderr).unwrap(),
        format!("{expected}[mokly/build-invalid] 3 build warnings with --strict\n")
    );
    assert_eq!(
        fs::read(root.path().join("site/mokly-viewer/index.json")).unwrap(),
        index
    );
    assert_eq!(
        fs::read(root.path().join("site/.mokly-export-artifact")).unwrap(),
        marker
    );
}
