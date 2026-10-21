//! Ignore-wrapper attributes disappear before composition can read the parsed tree.

use mokly_catalogue::template_types::Template;

use crate::tree::{self, Node};
use crate::{parse, serialize, source_checks, source_locations};

fn check_consumer(parser: fn(&str) -> Vec<Node>) {
    for (wrapper, required, key) in [
        ("mokly-ignore", "id='clock' material-key='v1'", "id"),
        ("mokly-ignore-scope", "enabled='true'", "enabled"),
    ] {
        let source = format!(
            "<{wrapper} {required} mokly-if='$visible' mokly-viewport='mobile' class='hidden' href='mock:missing' slot='missing' extra='{{{{absent}}}}'><span class='kept'>Text</span></{wrapper}>"
        );
        let nodes = parser(&source);
        let element = tree::walk(&nodes)
            .find_map(|node| match node {
                Node::Element(element) if element.name == wrapper => Some(element),
                _ => None,
            })
            .unwrap();
        for name in ["class", "href", "slot", "extra"] {
            assert_eq!(
                element.get(name),
                None,
                "new consumer sees {name} on {wrapper}"
            );
        }
        assert!(element.get(key).is_some());
        assert_eq!(element.get("mokly-if"), Some("$visible"));
        assert_eq!(element.get("mokly-viewport"), Some("mobile"));
        if wrapper == "mokly-ignore" {
            assert_eq!(element.get("material-key"), Some("v1"));
        }
        assert!(serialize::html(&nodes).contains("<span class=\"kept\">Text</span>"));
    }
}

#[test]
fn new_fragment_consumers_cannot_read_unknown_ignore_attributes() {
    check_consumer(parse::fragment);
}

#[test]
fn new_document_consumers_cannot_read_unknown_ignore_attributes() {
    check_consumer(parse::document);
}

#[test]
fn screen_component_and_page_locations_survive_attribute_removal() {
    for (path, page) in [
        ("specs/home.screen.html", false),
        ("specs/panel.component.html", false),
        ("specs/guide.page.html", true),
    ] {
        let header = "---\r\ntitle: Å\r\n---\r\n";
        let scopes = "<mokly-ignore-scope enabled='true' extra='é'>One</mokly-ignore-scope>\r\n<mokly-ignore-scope enabled='true' extra='中'>Two</mokly-ignore-scope>";
        let body = if page {
            format!("<!doctype html><html><head></head><body>\r\n{scopes}</body></html>")
        } else {
            scopes.into()
        };
        let nodes = source_locations::template(&Template {
            source_path: path.into(),
            source: format!("{header}{body}"),
            body,
            body_offset: header.len(),
            page,
        })
        .unwrap();
        let scopes: Vec<_> = tree::walk(&nodes)
            .filter_map(|node| match node {
                Node::Element(element) if element.name == "mokly-ignore-scope" => Some(element),
                _ => None,
            })
            .collect();
        assert_eq!(scopes.len(), 2);
        let first_line = if page { 5 } else { 4 };
        for (offset, scope) in scopes.iter().enumerate() {
            assert_eq!(scope.get("extra"), None);
            let location = scope.source.as_ref().unwrap();
            assert_eq!(location.path, path);
            assert_eq!((location.line, location.column), (first_line + offset, 1));
            assert_eq!(
                scope.origin,
                Some(format!("{path}:{}:1", first_line + offset))
            );
        }
    }
}

#[test]
fn foster_parented_wrappers_keep_their_original_locations() {
    check_repaired_locations(
        "<table>\n<tr><td><mokly-ignore-scope enabled='invalid' extra='first'>First</mokly-ignore-scope></td></tr>\n<mokly-ignore-scope enabled='invalid' extra='second'>Second</mokly-ignore-scope>\n</table>",
        &[("Second", 3, 1), ("First", 2, 9)],
    );
}

#[test]
fn select_wrappers_keep_their_original_locations() {
    check_repaired_locations(
        "<select><mokly-ignore-scope enabled='invalid' extra='first'>First</mokly-ignore-scope></select>\n<mokly-ignore-scope enabled='invalid' extra='second'>Second</mokly-ignore-scope>",
        &[("First", 1, 9), ("Second", 2, 1)],
    );
}

#[test]
fn plaintext_reparse_keeps_noscript_wrapper_locations_in_source_order() {
    let source = "<noscript><mokly-ignore-scope enabled='true' typo='x'>A</mokly-ignore-scope></noscript>\n<mokly-ignore-scope enabled='true'>B</mokly-ignore-scope><plaintext>";
    let nodes = source_locations::template(&Template {
        source_path: "specs/example.screen.html".into(),
        source: source.into(),
        body: source.into(),
        body_offset: 0,
        page: false,
    })
    .unwrap();
    let scopes: Vec<_> = tree::walk(&nodes)
        .filter_map(|node| match node {
            Node::Element(element) if element.name == "mokly-ignore-scope" => Some(element),
            _ => None,
        })
        .collect();
    assert_eq!(scopes.len(), 2);
    assert_eq!(
        scopes[0]
            .source
            .as_ref()
            .map(|source| (source.line, source.column)),
        Some((1, 11))
    );
    assert_eq!(
        scopes[1]
            .source
            .as_ref()
            .map(|source| (source.line, source.column)),
        Some((2, 1))
    );
}

fn check_repaired_locations(body: &str, expected: &[(&str, usize, usize)]) {
    for page in [false, true] {
        for suffix in ["", "<plaintext>Raw text"] {
            let body = if page {
                format!("<!doctype html><html><head></head><body>\n{body}{suffix}</body></html>")
            } else {
                format!("{body}{suffix}")
            };
            let path = "specs/example.html";
            let nodes = source_locations::template(&Template {
                source_path: path.into(),
                source: body.clone(),
                body,
                body_offset: 0,
                page,
            })
            .unwrap();
            let scopes: Vec<_> = tree::walk(&nodes)
                .filter_map(|node| match node {
                    Node::Element(element) if element.name == "mokly-ignore-scope" => Some(element),
                    _ => None,
                })
                .collect();
            assert_eq!(scopes.len(), expected.len());
            for (scope, (text, line, column)) in scopes.iter().zip(expected) {
                assert_eq!(scope.get("extra"), None);
                assert_eq!(serialize::html(&scope.children), *text);
                let location = scope.source.as_ref().unwrap();
                let line = line + usize::from(page);
                assert_eq!((location.line, location.column), (line, *column));
                assert_eq!(location.path, path);
                assert_eq!(scope.origin, Some(format!("{path}:{line}:{column}")));
            }
        }
    }
}

#[test]
fn reserved_navigation_fields_remain_visible_and_fail_as_before() {
    for (wrapper, required) in [
        ("mokly-ignore", "id='clock'"),
        ("mokly-ignore-scope", "enabled='false'"),
    ] {
        for name in ["data-mokly-link", "data-mokly-link-control-future"] {
            let source = format!("<{wrapper} {required} {name}='forged'></{wrapper}>");
            assert_eq!(
                source_checks::validate(&source, false)
                    .unwrap_err()
                    .to_string(),
                "[mokly-html/build-invalid] reserved navigation metadata in consumer output"
            );
            let nodes = parse::fragment(&source);
            let Node::Element(element) = &nodes[0] else {
                panic!("expected the ignore wrapper");
            };
            assert_eq!(element.get(name), Some("forged"));
            let template = Template {
                source_path: "specs/home.screen.html".into(),
                source: source.clone(),
                body: source,
                body_offset: 0,
                page: false,
            };
            assert_eq!(
                source_locations::template(&template)
                    .unwrap_err()
                    .to_string(),
                "[mokly-html/build-invalid] reserved navigation metadata in consumer output"
            );
        }
    }
}

#[test]
fn duplicate_navigation_attributes_on_wrappers_still_fail() {
    for wrapper in ["mokly-ignore", "mokly-ignore-scope"] {
        for attribute in [
            "href",
            "data-nav-href",
            "data-mokly-link",
            "data-mokly-target",
            "data-mokly-link-control-future",
        ] {
            let source = format!(
                "<{wrapper} {attribute}='first' {}='second'></{wrapper}>",
                attribute.to_ascii_uppercase()
            );
            assert_eq!(
                source_checks::validate(&source, false)
                    .unwrap_err()
                    .to_string(),
                format!("[mokly-html/build-invalid] duplicate navigation attribute {attribute}")
            );
        }
    }
}

#[test]
fn literal_ignore_markup_in_raw_text_keeps_its_attributes() {
    let source = "<script>\"<mokly-ignore class='literal'>\"</script>";
    assert_eq!(serialize::html(&parse::fragment(source)), source);
}
