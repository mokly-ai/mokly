//! Missing stylesheet inputs name the package that holds the target.

use std::collections::BTreeMap;

use crate::resolver::ImportResolver;

use super::resolver_with_files;

const THEME_LINK: [(&str, &str); 1] = [("node_modules/theme", "packages/theme")];

#[test]
fn only_package_imports_with_a_reachable_layout_name_the_override() {
    let mut resolver = resolver_with_files(
        &[
            ("package.json", r#"{"name":"catalogue"}"#),
            (
                "packages/theme/package.json",
                r#"{"name":"workspace-theme","exports":{"./colors":"./esm/skin.css"}}"#,
            ),
        ],
        &THEME_LINK,
    );
    let error = resolver
        .resolve("styles/entry.css", "theme-alias/colors")
        .unwrap_err();
    assert_eq!(
        error.to_string(),
        "[mokly-css/build-invalid] could not resolve CSS @import in styles/entry.css: theme-alias/colors; set moduleResolution.sourcePackages for workspace-theme"
    );
    let error = resolver
        .resolve("styles/entry.css", "./missing.css")
        .unwrap_err();
    assert_eq!(
        error.to_string(),
        "[mokly-css/build-invalid] could not resolve CSS @import in styles/entry.css: ./missing.css; use an existing stylesheet inside repoRoot"
    );
    resolver.settings.source_packages = vec![
        BTreeMap::from([(
            "workspace-theme".into(),
            Some(BTreeMap::from([("esm".into(), "missing".into())])),
        )]),
        BTreeMap::from([("workspace-theme".into(), None)]),
    ];
    let error = resolver
        .resolve("styles/entry.css", "theme-alias/colors")
        .unwrap_err();
    assert_eq!(
        error.to_string(),
        "[mokly-css/build-invalid] could not resolve CSS @import in styles/entry.css: theme-alias/colors; use an existing stylesheet inside repoRoot"
    );
}

#[test]
fn a_missing_default_entry_keeps_the_local_path_message() {
    let default_entry = resolver_with_files(
        &[
            ("package.json", r#"{"name":"catalogue"}"#),
            (
                "packages/theme/package.json",
                r#"{"name":"workspace-theme"}"#,
            ),
        ],
        &THEME_LINK,
    );
    let error = default_entry
        .resolve("styles/entry.css", "theme-alias")
        .unwrap_err();
    assert_eq!(
        error.to_string(),
        "[mokly-css/build-invalid] could not resolve CSS @import in styles/entry.css: theme-alias; use an existing stylesheet inside repoRoot"
    );
}
