//! Workspace patterns stay confined through every brace and `**` expansion.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::error::{Error, Result};
use crate::local_packages::validate;

fn check(pattern: &str) -> Result<()> {
    let manifest = serde_json::json!({ "workspaces": [pattern] }).to_string();
    validate(&BTreeMap::from([(
        RepoPath::parse("package.json").unwrap(),
        manifest.into_bytes(),
    )]))
}

#[test]
fn later_nested_and_globstar_expansions_cannot_escape() {
    for pattern in [
        "packages/{a}/{b,../../../x}",
        "x{/{b,../../y}",
        "packages/**/../../x",
        "{a,b/../../x}",
        "{**}/../x",
        "{,a}",
        "{~,x}/y",
        "{/abs,x}",
    ] {
        assert!(
            matches!(check(pattern), Err(Error::LocalOutside { .. })),
            "{pattern}"
        );
    }
}

#[test]
fn confined_patterns_and_literal_braces_remain_valid() {
    for pattern in [
        "packages/*",
        "packages/**",
        "apps/{a,b}/*",
        "{a}",
        "x{",
        "}",
        "a,b",
        "packages/{a,b/..}",
        "packages/*/../shared",
    ] {
        let result = check(pattern);
        assert!(result.is_ok(), "{pattern}: {result:?}");
    }
}

#[test]
fn many_and_deeply_nested_groups_need_no_expansion_list() {
    let many = "{a,b}/".repeat(64) + "x";
    let deep = "{".repeat(10_000) + "a" + &"}".repeat(10_000);
    for pattern in [many, deep] {
        let result = check(&pattern);
        assert!(result.is_ok(), "{result:?}");
    }
    let escape = "{a,b}/".repeat(64) + &"../".repeat(65) + "x";
    assert!(matches!(check(&escape), Err(Error::LocalOutside { .. })));
}
