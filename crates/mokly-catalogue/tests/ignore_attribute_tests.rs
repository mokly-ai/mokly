//! Shared-body ignore warnings retain their exact identity after parser filtering.

use mokly_catalogue::diagnostic::WarningSubject;

mod support;

#[test]
fn screen_warns_once_for_an_attribute_shared_by_both_wrapper_kinds() {
    check_wrapper_kinds("screen");
}

#[test]
fn component_warns_once_for_an_attribute_shared_by_both_wrapper_kinds() {
    check_wrapper_kinds("component");
}

#[test]
fn page_warns_once_for_an_attribute_shared_by_both_wrapper_kinds() {
    check_wrapper_kinds("page");
}

fn check_wrapper_kinds(kind: &str) {
    for reversed in [false, true] {
        let root = tempfile::tempdir().unwrap();
        support::write(root.path(), "mokly.config.json", "{}");
        let wrappers = [
            "<mokly-ignore id='clock' extra='first'>First</mokly-ignore>",
            "<mokly-ignore-scope enabled='true' EXTRA='second'>Second</mokly-ignore-scope>",
        ];
        let body = if reversed {
            format!("{}{}", wrappers[1], wrappers[0])
        } else {
            wrappers.join("")
        };
        let metadata = if kind == "component" {
            "element: ui-example\npropSchema: {type: object, additionalProperties: false, properties: {}}\n"
        } else {
            ""
        };
        let body = if kind == "page" {
            format!("<!doctype html><html><head></head><body>{body}</body></html>")
        } else {
            body
        };
        support::write(
            root.path(),
            &format!("specs/example.{kind}.html"),
            &format!("---\ntitle: Example\n{metadata}---\n{body}"),
        );
        let prepared = support::prepare(root.path(), Some("mokly.config.json")).unwrap();
        let first = if reversed {
            "mokly-ignore-scope"
        } else {
            "mokly-ignore"
        };
        assert_eq!(prepared.warnings.len(), 1, "{kind}, first wrapper {first}");
        assert_eq!(prepared.warnings[0].code, "html-ignore-attribute");
        assert_eq!(
            prepared.warnings[0].message,
            format!("unknown attribute extra on <{first}> is ignored")
        );
    }
}

#[test]
fn ignore_attributes_warn_once_per_shared_screen_component_and_page_body() {
    for kind in ["screen", "component", "page"] {
        let root = tempfile::tempdir().unwrap();
        support::write(root.path(), "mokly.config.json", "{}");
        let metadata = match kind {
            "screen" => "variants: [{slug: other, title: Other}]\n",
            "component" => {
                "element: ui-example\npropSchema: {type: object, additionalProperties: false, properties: {}}\nvariants: [{slug: other, title: Other, props: {}}]\n"
            }
            _ => "",
        };
        let body = "<mokly-ignore id='first' href='mock:missing' slot='missing' extra='{{absent}}'><p>First</p></mokly-ignore><mokly-ignore id='second' href='mock:also-missing' slot='named' extra='$absent'><p>Second</p></mokly-ignore><mokly-ignore-scope enabled='true' typo='ignored'><p>Third</p></mokly-ignore-scope><mokly-ignore-scope enabled='false' typo='also ignored'><p>Fourth</p></mokly-ignore-scope>";
        let body = if kind == "page" {
            format!("<!doctype html><html><head></head><body>{body}</body></html>")
        } else {
            body.into()
        };
        support::write(
            root.path(),
            &format!("specs/example.{kind}.html"),
            &format!("---\ntitle: Example\n{metadata}---\n{body}"),
        );
        let prepared = support::prepare(root.path(), Some("mokly.config.json")).unwrap();
        assert_eq!(
            prepared.model.entries.len(),
            if kind == "page" { 1 } else { 2 }
        );
        let subject = if kind == "component" {
            WarningSubject::Component("example".into())
        } else {
            WarningSubject::Entry("example".into())
        };
        let warnings: Vec<_> = prepared
            .warnings
            .iter()
            .map(|warning| {
                assert_eq!(warning.code, "html-ignore-attribute");
                assert_eq!(warning.subject, subject);
                warning.message.as_str()
            })
            .collect();
        assert_eq!(
            warnings,
            [
                "unknown attribute extra on <mokly-ignore> is ignored",
                "unknown attribute href on <mokly-ignore> is ignored",
                "unknown attribute slot on <mokly-ignore> is ignored",
                "unknown attribute typo on <mokly-ignore-scope> is ignored",
            ],
            "{kind} keeps one warning for each repeated attribute"
        );
    }
}

#[test]
fn saved_variant_slots_warn_for_unknown_ignore_attributes() {
    let root = tempfile::tempdir().unwrap();
    support::write(root.path(), "mokly.config.json", "{}");
    support::write(
        root.path(),
        "specs/button.component.html",
        "---\ntitle: Button\nelement: ui-button\npropSchema: {type: object, additionalProperties: false, properties: {}}\nslots: [children]\nvariants:\n  - slug: warning\n    title: Warning\n    props: {}\n    slots:\n      children: >-\n        <mokly-ignore-scope enabled='true' typo='x'>A</mokly-ignore-scope>\n---\n<slot></slot>",
    );
    let prepared = support::prepare(root.path(), Some("mokly.config.json")).unwrap();
    let warnings: Vec<_> = prepared
        .warnings
        .iter()
        .filter(|warning| warning.code == "html-ignore-attribute")
        .collect();
    assert_eq!(warnings.len(), 1);
    assert_eq!(
        warnings[0].message,
        "unknown attribute typo on <mokly-ignore-scope> is ignored"
    );
}

#[test]
fn reserved_navigation_warning_names_rejection_instead_of_ignoring() {
    let root = tempfile::tempdir().unwrap();
    support::write(root.path(), "mokly.config.json", "{}");
    support::write(
        root.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<mokly-ignore-scope enabled='true' data-mokly-link='forged'>Home</mokly-ignore-scope>",
    );
    let prepared = support::prepare(root.path(), Some("mokly.config.json")).unwrap();
    assert_eq!(
        prepared.warnings[0].message,
        "reserved navigation metadata data-mokly-link on <mokly-ignore-scope> is rejected"
    );
}

#[test]
fn saved_variant_slots_do_not_create_component_cycles() {
    let root = tempfile::tempdir().unwrap();
    support::write(root.path(), "mokly.config.json", "{}");
    support::write(
        root.path(),
        "specs/tree.component.html",
        "---
title: Tree
element: tree-item
propSchema: {type: object, additionalProperties: false, properties: {}}
slots: [children]
variants:
  - slug: self
    title: Self
    props: {}
    slots:
      children: '<tree-item></tree-item>'
---
<slot></slot>",
    );
    support::prepare(root.path(), Some("mokly.config.json")).unwrap();
}

#[test]
fn saved_variant_slots_keep_element_failures_deferred() {
    for body in [
        "<unknown-widget></unknown-widget>",
        "<script>ignored</script>",
    ] {
        let root = tempfile::tempdir().unwrap();
        support::write(root.path(), "mokly.config.json", "{}");
        support::write(
            root.path(),
            "specs/tree.component.html",
            &format!(
                "---\ntitle: Tree\nelement: tree-item\npropSchema: {{type: object, additionalProperties: false, properties: {{}}}}\nslots: [children]\nvariants:\n  - slug: saved\n    title: Saved\n    props: {{}}\n    slots:\n      children: {body:?}\n---\n<slot></slot>"
            ),
        );
        support::prepare(root.path(), Some("mokly.config.json")).unwrap();
    }
}

#[test]
fn wrapper_warnings_follow_the_html_parser_text_modes() {
    let wrapper = "<mokly-ignore-scope enabled='true' typo='x'>A</mokly-ignore-scope>";
    for (context, warnings) in [
        ("<svg><desc><style>{}</style></desc></svg>", 0),
        ("<svg><textarea>{}</textarea></svg>", 1),
    ] {
        let root = tempfile::tempdir().unwrap();
        support::write(root.path(), "mokly.config.json", "{}");
        support::write(
            root.path(),
            "specs/home.screen.html",
            &format!("---\ntitle: Home\n---\n{}", context.replace("{}", wrapper)),
        );
        let prepared = support::prepare(root.path(), Some("mokly.config.json")).unwrap();
        assert_eq!(prepared.warnings.len(), warnings, "{context}");
    }
}
