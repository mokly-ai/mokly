//! Stylesheet extglobs report one configuration warning without changing preparation.

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::error::CatalogueError;
use serde_json::json;
use tempfile::TempDir;

mod support;

fn fixture(pattern: &str) -> TempDir {
    let directory = TempDir::new().unwrap();
    support::write(
        directory.path(),
        "tools/mokly.json",
        &json!({
            "repoRoot":"..", "roots":[{"dir":"../specs"}],
            "stylesheets":[{"match":pattern,"stylesheets":["../theme.css"]}]
        })
        .to_string(),
    );
    support::write(directory.path(), "theme.css", "h1 {color: red}");
    support::write(
        directory.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<h1>Home</h1>",
    );
    directory
}

#[test]
fn each_extglob_operator_warns_once_with_exact_code_subject_and_text() {
    for operator in ["@", "!", "+", "*", "?"] {
        let pattern = format!("{operator}(home|other)/**");
        let directory = fixture(&pattern);
        let prepared = support::prepare(directory.path(), Some("tools/mokly.json")).unwrap();
        assert_eq!(prepared.model.entries.len(), 1);
        assert_eq!(
            prepared.warnings,
            [Warning {
                code: "stylesheet-extglob",
                subject: WarningSubject::Configuration("tools/mokly.json".into()),
                message: format!(
                    "stylesheet match \"{pattern}\" uses unsupported extglob syntax. Use brace alternatives such as \"{{a,b}}\" instead."
                ),
            }]
        );
    }
}

#[test]
fn brace_alternatives_and_literal_character_classes_do_not_warn() {
    for pattern in [
        "{home,other}/**",
        "[ho]ome/**",
        "[@(]/**",
        "[]@(]/**",
        "[!@(]/**",
    ] {
        let directory = fixture(pattern);
        let prepared = support::prepare(directory.path(), Some("tools/mokly.json")).unwrap();
        assert!(
            prepared.warnings.is_empty(),
            "{pattern}: {:?}",
            prepared.warnings
        );
    }
}

#[test]
fn multiple_extglob_groups_in_one_matcher_produce_one_warning() {
    let directory = fixture("@(home|other)/+(a|b)/**");
    let prepared = support::prepare(directory.path(), Some("tools/mokly.json")).unwrap();
    assert_eq!(prepared.warnings.len(), 1);
    assert_eq!(
        prepared.warnings[0].message,
        "stylesheet match \"@(home|other)/+(a|b)/**\" uses unsupported extglob syntax. Use brace alternatives such as \"{a,b}\" instead."
    );
}

#[test]
fn extglob_warning_survives_a_later_catalogue_validation_failure() {
    let directory = fixture("@(home|other)/**");
    support::write(
        directory.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<ui-missing></ui-missing>",
    );
    let CatalogueError::Invalid { warnings, .. } =
        support::prepare(directory.path(), Some("tools/mokly.json")).unwrap_err()
    else {
        panic!("expected catalogue validation failure");
    };
    assert_eq!(warnings.len(), 1);
    assert_eq!(warnings[0].code, "stylesheet-extglob");
}

#[test]
fn warning_quotes_the_pattern_and_escapes_authored_control_characters() {
    let directory = fixture("@(a|b)/\"\n\u{0085}\\");
    let prepared = support::prepare(directory.path(), Some("tools/mokly.json")).unwrap();
    assert_eq!(prepared.warnings.len(), 1);
    assert_eq!(
        prepared.warnings[0].message,
        "stylesheet match \"@(a|b)/\\\"\\u000a\\u0085\\\\\" uses unsupported extglob syntax. Use brace alternatives such as \"{a,b}\" instead."
    );
}

#[test]
fn a_configuration_outside_repo_root_uses_its_basename_as_subject() {
    let directory = fixture("@(home|other)/**");
    support::write(
        directory.path(),
        "outside.json",
        &json!({
            "repoRoot":"specs", "roots":[{"dir":"specs"}],
            "stylesheets":[{"match":"@(home|other)/**","stylesheets":[]}]
        })
        .to_string(),
    );
    let prepared = support::prepare(directory.path(), Some("outside.json")).unwrap();
    assert_eq!(prepared.warnings.len(), 1);
    assert_eq!(
        prepared.warnings[0].subject,
        WarningSubject::Configuration("outside.json".into())
    );
}
