//! URL schemes occur before the first path, query, or fragment delimiter.

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_model::catalogue::SourceLocation;

use crate::{parse, url_safety};

#[test]
fn colons_outside_a_valid_scheme_are_allowed_in_href_and_src() {
    for url in [
        "#x:y",
        "?t=10:30",
        "./images/a:b.svg",
        "images/a:b.svg",
        "https://example.com:8443/a?time=10:30#x:y",
    ] {
        for attribute in ["href", "src"] {
            let nodes = parse::html(DeliveredHtml::fragment(&format!(
                "<a {attribute}=\"{url}\">Go</a>"
            )));
            url_safety::validate(&nodes, &location()).unwrap();
        }
    }
}

#[test]
fn disallowed_schemes_and_protocol_relative_urls_still_fail() {
    for url in [
        "data:image/png;base64,AA",
        "//example.com/a",
        "tel:123",
        "javascript:void(0)",
        "custom+app.2:go",
    ] {
        for attribute in ["href", "src"] {
            let nodes = parse::html(DeliveredHtml::fragment(&format!(
                "<a {attribute}=\"{url}\">Go</a>"
            )));
            assert!(
                url_safety::validate(&nodes, &location()).is_err(),
                "{attribute}={url}"
            );
        }
    }
}

fn location() -> SourceLocation {
    SourceLocation {
        path: "specs/a.screen.html".into(),
        line: 4,
        column: 1,
        export: None,
    }
}
