//! Review regressions for complete diagnostics and non-cascading failures.

use mokly_catalogue::diagnostic::Issue;
use mokly_catalogue::error::CatalogueError;
use tempfile::TempDir;

#[path = "support/fixtures.rs"]
mod fixtures;
mod support;

fn catalogue(files: &[(&str, &str)]) -> TempDir {
    let directory = TempDir::new().unwrap();
    support::write(directory.path(), "mokly.config.json", "{}");
    for (path, text) in files {
        support::write(directory.path(), path, text);
    }
    directory
}

fn issues(files: &[(&str, &str)]) -> Vec<Issue> {
    let directory = catalogue(files);
    match support::prepare(directory.path(), Some("mokly.config.json")).unwrap_err() {
        CatalogueError::Invalid { issues, .. } => issues,
        error => panic!("unexpected error: {error:?}"),
    }
}

#[test]
fn a_shared_body_reports_each_error_once_with_variants() {
    fixtures::check("variant-body-errors");
}

#[test]
fn shared_body_warnings_use_only_the_parent_subject() {
    fixtures::check("variant-body-warning");
}

#[test]
fn component_body_warning_subjects_are_consistent() {
    fixtures::check("component-body-warnings");
}

#[test]
fn case_only_leaf_folder_collisions_are_rejected() {
    let errors = issues(&[
        (
            "specs/billing/Invoice.screen.html",
            "---\ntitle: Invoice\n---\n<h1>Invoice</h1>",
        ),
        ("specs/billing/invoice/lines.md", "# Lines"),
    ]);
    assert_eq!(errors.len(), 1, "{errors:?}");
    assert_eq!(errors[0].code.as_str(), "case-collision");
    assert_eq!(
        errors[0].message,
        "paths billing/Invoice and billing/invoice differ only by letter case:\n  specs/billing/Invoice.screen.html\n  specs/billing/invoice/lines.md"
    );
}

#[test]
fn invalid_parent_props_keep_relationships_and_variant_shape_checks() {
    let errors = issues(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\nuseCasePaths: [tour]\npropSchema: {type: object, additionalProperties: false, properties: {label: {type: string}}}\nprops: {label: 42}\nvariants:\n  - {slug: a, title: A, bogus: true}\n---\n<h1>{{label}}</h1>",
        ),
        (
            "specs/tour.use-case.yaml",
            "title: Tour\nsteps: [{screenPath: home}]",
        ),
    ]);
    assert_eq!(errors.len(), 2, "{errors:?}");
    assert_eq!(errors[0].code.as_str(), "html-attribute");
    assert_eq!(errors[1].code.as_str(), "invalid-field");
    assert_eq!(errors[1].message, "home/a: unknown field bogus");
}

#[test]
fn invalid_component_props_do_not_make_its_element_unknown() {
    let errors = issues(&[
        (
            "specs/button.component.html",
            "---\ntitle: Button\nelement: ui-button\npropSchema: {type: object, additionalProperties: false, properties: {label: {type: string}}}\nprops: {label: 42}\n---\n<button>{{label}}</button>",
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<ui-button></ui-button>",
        ),
    ]);
    assert_eq!(errors.len(), 1, "{errors:?}");
    assert_eq!(errors[0].code.as_str(), "html-attribute");
}

#[test]
fn missing_step_fields_do_not_add_flow_cascades() {
    let errors = issues(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\nuseCasePaths: [tour]\n---\n<h1>Home</h1>",
        ),
        (
            "specs/tour.use-case.yaml",
            "title: Tour\nsteps:\n  - title: Missing",
        ),
    ]);
    assert_eq!(errors.len(), 1, "{errors:?}");
    assert_eq!(errors[0].message, "step #1: screenPath must be a string");
    let location = errors[0].location.as_ref().unwrap();
    assert_eq!((location.line, location.column), (3, 5));
}

#[test]
fn ordinary_to_attributes_and_screen_framework_prop_names_are_valid() {
    let directory = catalogue(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\nprops: {key: one, ref: two, moklyInstance: three}\n---\n<p to=\"nowhere\">{{key}} {{ref}} {{moklyInstance}}</p><input to=\"also-nowhere\">",
    )]);
    let prepared = support::prepare(directory.path(), Some("mokly.config.json")).unwrap();
    assert!(prepared.warnings.is_empty());
}

#[test]
fn component_variants_require_props_and_duplicate_indices_report_once() {
    let errors = issues(&[(
        "specs/button.component.html",
        "---\ntitle: Button\nelement: ui-button\npropSchema: {type: object, additionalProperties: false, properties: {}}\nvariants: [{slug: a, title: A}]\n---\n<button>Button</button>",
    )]);
    assert_eq!(errors.len(), 1, "{errors:?}");
    assert_eq!(
        errors[0].message,
        "props is required for a component variant"
    );
    let errors = issues(&[
        ("specs/guide/index.md", "# Index"),
        ("specs/guide/README.md", "# Readme"),
    ]);
    assert_eq!(errors.len(), 1, "{errors:?}");
    assert_eq!(errors[0].code.as_str(), "duplicate-index");
}

#[test]
fn scheme_errors_point_at_the_authored_field() {
    for (text, line, column, message) in [
        (
            "---\ntitle: Home\ncolorSchemes: [blue]\n---\n<h1>Home</h1>",
            3,
            1,
            "colorSchemes must contain only light or dark",
        ),
        (
            "---\ntitle: Home\ncolorSchemes: [light, dark]\n---\n<h1>Home</h1>",
            3,
            1,
            "colorSchemes must be a nonempty unique subset including light",
        ),
        (
            "---\ntitle: Home\nvariants:\n  - slug: a\n    title: A\n    colorSchemes: [blue]\n---\n<h1>Home</h1>",
            6,
            5,
            "colorSchemes must contain only light or dark",
        ),
    ] {
        let errors = issues(&[("specs/home.screen.html", text)]);
        assert_eq!(errors.len(), 1, "{errors:?}");
        assert_eq!(errors[0].message, message);
        let location = errors[0].location.as_ref().unwrap();
        assert_eq!((location.line, location.column), (line, column));
    }
}

#[test]
fn variant_slot_types_are_checked_at_the_value_field_before_deserialization() {
    let text = "---\ntitle: Button\nelement: ui-button\npropSchema: {type: object, additionalProperties: false, properties: {}}\nslots: [children]\nvariants:\n  - slug: a\n    title: A\n    props: {}\n    slots:\n      children: false\n---\n<slot></slot>";
    let errors = issues(&[("specs/button.component.html", text)]);
    assert_eq!(errors.len(), 1, "{errors:?}");
    assert_eq!(errors[0].message, "slot children must be a string");
    let location = errors[0].location.as_ref().unwrap();
    assert_eq!((location.line, location.column), (11, 7));
}

#[test]
fn invalid_utf8_folder_records_use_the_folder_json_diagnostic() {
    let directory = catalogue(&[("specs/guide.md", "# Guide")]);
    std::fs::write(
        directory.path().join("specs/_folder.json"),
        [b'{', 0xff, b'}'],
    )
    .unwrap();
    let CatalogueError::Invalid { issues, .. } =
        support::prepare(directory.path(), Some("mokly.config.json")).unwrap_err()
    else {
        panic!()
    };
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].code.as_str(), "invalid-folder");
    assert_eq!(
        issues[0].message,
        "specs/_folder.json: invalid JSON: key must be a string at line 1 column 2"
    );
    let location = issues[0].location.as_ref().unwrap();
    assert_eq!((location.line, location.column), (1, 2));
}

#[test]
fn markdown_utf8_errors_use_document_metadata_codes_and_exact_locations() {
    let directory = catalogue(&[("specs/guide.md", "# Guide")]);
    std::fs::write(directory.path().join("specs/guide.md"), b"# Guide\n\xff").unwrap();
    let CatalogueError::Invalid { issues, .. } =
        support::prepare(directory.path(), Some("mokly.config.json")).unwrap_err()
    else {
        panic!()
    };
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].code.as_str(), "document-front-matter");
    assert_eq!(
        issues[0].message,
        "specs/guide.md: front matter file must be UTF-8"
    );
    let location = issues[0].location.as_ref().unwrap();
    assert_eq!((location.line, location.column), (2, 1));
}

#[test]
fn failed_parents_keep_variant_slug_checks_without_checking_child_props() {
    let text = "---\ntitle: Home\npropSchema: {type: object, additionalProperties: false, properties: {n: {type: number}}}\nprops: {n: wrong}\nvariants:\n  - {slug: a, title: A, props: {n: also-wrong}}\n  - {slug: a, title: B, props: {n: still-wrong}}\n---\n<p>{{n}}</p>";
    let errors = issues(&[("specs/home.screen.html", text)]);
    assert_eq!(errors.len(), 2, "{errors:?}");
    assert_eq!(errors[0].code.as_str(), "html-attribute");
    assert_eq!(errors[1].code.as_str(), "duplicate-path");
}
