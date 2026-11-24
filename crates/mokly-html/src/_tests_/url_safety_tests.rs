//! URL schemes occur before the first path, query, or fragment delimiter.

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_model::catalogue::SourceLocation;

use crate::diagnostic_code::Code;
use crate::error::HtmlError;
use crate::{document_style, parse, safety, url_safety};

const REJECTED_IMAGE_URLS: [(&str, &str); 3] = [
    (
        "data:image/png;base64,AA",
        "unsafe rendered document: src on <img> is not an allowed URL: \"data:image/png;base64,AA\"; remove the dataurl loader from moduleResolution.loaders so that Mokly delivers the imported file",
    ),
    (
        "DATA:image/png;base64,AA",
        "unsafe rendered document: src on <img> is not an allowed URL: \"DATA:image/png;base64,AA\"; remove the dataurl loader from moduleResolution.loaders so that Mokly delivers the imported file",
    ),
    (
        "javascript:void(0)",
        "unsafe rendered document: src on <img> is not an allowed URL: \"javascript:void(0)\"",
    ),
];

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

#[test]
fn composed_image_url_errors_give_loader_advice_for_data_urls() {
    for (url, expected) in REJECTED_IMAGE_URLS {
        let nodes = parse::html(DeliveredHtml::fragment(&format!("<img src=\"{url}\">")));
        let error = url_safety::validate(&nodes, &location()).unwrap_err();
        let HtmlError::Located { source, .. } = error else {
            panic!("expected a source-attributed URL error, got {error}");
        };
        assert_rejected_url(*source, expected);
    }
}

#[test]
fn markdown_image_url_errors_give_loader_advice_for_data_urls() {
    let route = "guide/index.html";
    let stylesheet = document_style::stylesheet(route);
    for (url, expected) in REJECTED_IMAGE_URLS {
        let document = format!(
            "<!doctype html><html><head><style>{stylesheet}</style></head><body><main><img src=\"{url}\"></main></body></html>"
        );
        let nodes = parse::html(DeliveredHtml::document(&document));
        let error = safety::validate(&nodes, route).unwrap_err();
        assert_rejected_url(error, expected);
    }
}

fn assert_rejected_url(error: HtmlError, expected: &str) {
    let HtmlError::Invalid { code, message, .. } = error else {
        panic!("expected an invalid URL error, got {error}");
    };
    assert_eq!(code, Code::BuildInvalid);
    assert_eq!(message, expected);
}

fn location() -> SourceLocation {
    SourceLocation {
        path: "specs/a.screen.html".into(),
        line: 4,
        column: 1,
        export: None,
    }
}
