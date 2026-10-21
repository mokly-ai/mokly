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
