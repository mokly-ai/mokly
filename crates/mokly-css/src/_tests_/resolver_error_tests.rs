//! Missing stylesheet inputs name the package that holds the target.

use crate::resolver::ImportResolver;

use super::resolver_with_files;

#[test]
fn unresolved_workspace_style_names_its_package_and_the_authored_alias() {
    let resolver = resolver_with_files(
        &[(
            "packages/theme/package.json",
            r#"{"name":"workspace-theme","exports":{"./colors":"./esm/skin.css"}}"#,
        )],
        Some(("node_modules/theme", "packages/theme")),
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

    let default_entry = resolver_with_files(
        &[
            ("package.json", r#"{"name":"catalogue"}"#),
            (
                "packages/theme/package.json",
                r#"{"name":"workspace-theme"}"#,
            ),
        ],
        Some(("node_modules/theme", "packages/theme")),
    );
    let error = default_entry
        .resolve("styles/entry.css", "theme-alias")
        .unwrap_err();
    assert_eq!(
        error.to_string(),
        "[mokly-css/build-invalid] could not resolve CSS @import in styles/entry.css: theme-alias; set moduleResolution.sourcePackages for workspace-theme"
    );
}
