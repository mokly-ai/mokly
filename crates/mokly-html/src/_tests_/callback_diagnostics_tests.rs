//! Page callback warnings retain removed wrapper attributes and callback failures.

use std::sync::Arc;

use mokly_catalogue::diagnostic::WarningSubject;
use mokly_catalogue::html_input::DeliveredHtml;
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::EntryContent;
use unimock::{MockFn, Unimock, matching};

use crate::composition::{ComposeRequest, Composed, Composer, HtmlComposer};
use crate::error::Result;
use crate::fragment::{Fragment, FragmentRendererMock};
use crate::{serialize, source_checks};

use super::support;

fn compose_page(html: &str) -> Result<Composed> {
    let mut catalogue = support::prepared("<p>Home</p>");
    catalogue.model.entries[0].metadata.path = "statement".into();
    catalogue.model.entries[0].content = EntryContent::Page;
    let renderer = Arc::new(Unimock::new(
        FragmentRendererMock::render
            .next_call(matching!(_))
            .returns(Ok(Fragment {
                html: html.into(),
                ..Default::default()
            })),
    ));
    HtmlComposer {
        fragments: renderer,
    }
    .compose(&ComposeRequest {
        catalogue: &catalogue,
        entry: &catalogue.model.entries[0],
        viewport: Viewport::Desktop,
        color_scheme: ColorScheme::Light,
        stylesheets: Vec::new(),
    })
}

fn callback_document(body: &str) -> String {
    format!("<!doctype html><html><head></head><body>{body}</body></html>")
}

#[test]
fn page_callbacks_warn_once_for_each_removed_wrapper_attribute() {
    let document = compose_page(&callback_document(
        "<mokly-ignore-scope enabled='true' typo='x'><mokly-ignore id='clock' extra='y' class='z'>Clock</mokly-ignore></mokly-ignore-scope>",
    ))
    .unwrap();
    let warnings = &document.warnings;
    assert_eq!(warnings.len(), 3);
    for (warning, message) in warnings.iter().zip([
        "unknown attribute typo on <mokly-ignore-scope> is ignored",
        "unknown attribute extra on <mokly-ignore> is ignored",
        "unknown attribute class on <mokly-ignore> is ignored",
    ]) {
        assert_eq!(warning.code, "html-ignore-attribute");
        assert_eq!(warning.subject, WarningSubject::Entry("statement".into()));
        assert_eq!(warning.message, message);
    }
}

#[test]
fn page_callback_warning_names_the_first_wrapper_in_document_order() {
    for (body, element) in [
        (
            "<mokly-ignore-scope enabled='true' extra='a'></mokly-ignore-scope><mokly-ignore id='clock' extra='b'></mokly-ignore>",
            "mokly-ignore-scope",
        ),
        (
            "<mokly-ignore id='clock' extra='a'></mokly-ignore><mokly-ignore-scope enabled='true' extra='b'></mokly-ignore-scope>",
            "mokly-ignore",
        ),
    ] {
        let document = compose_page(&callback_document(body)).unwrap();
        assert_eq!(document.warnings.len(), 1);
        assert_eq!(
            document.warnings[0].message,
            format!("unknown attribute extra on <{element}> is ignored")
        );
    }
}

#[test]
fn page_callback_failure_keeps_removed_attribute_warnings() {
    let error = compose_page(
        "<html><head></head><body><mokly-ignore id='clock' extra='y'>Clock</mokly-ignore></body></html>",
    )
    .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("page must start with <!doctype html>")
    );
    assert_eq!(error.warnings().len(), 1);
    assert_eq!(
        error.warnings()[0].message,
        "unknown attribute extra on <mokly-ignore> is ignored"
    );
}

#[test]
fn non_page_javascript_fragments_do_not_report_removed_wrapper_attributes() {
    let catalogue = support::prepared("<ui-js label='Receiver'></ui-js>");
    let renderer = Arc::new(Unimock::new(
        FragmentRendererMock::render
            .next_call(matching!(_))
            .returns(Ok(Fragment {
                html: "<mokly-ignore id='clock' extra='y'>Clock</mokly-ignore>".into(),
                ..Default::default()
            })),
    ));
    let entry = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap();
    let document = HtmlComposer {
        fragments: renderer,
    }
    .compose(&ComposeRequest {
        catalogue: &catalogue,
        entry,
        viewport: Viewport::Mobile,
        color_scheme: ColorScheme::Light,
        stylesheets: Vec::new(),
    })
    .unwrap();
    assert!(
        document
            .warnings
            .iter()
            .all(|warning| warning.code != "html-ignore-attribute")
    );
    assert!(serialize::html(&document.tree).contains("Clock"));
}

#[test]
fn callback_duplicate_non_navigation_attributes_name_their_kind() {
    let error = source_checks::validate(DeliveredHtml::fragment("<p class=a class=b>x</p>"), true)
        .unwrap_err();
    assert_eq!(
        error.to_string(),
        "[mokly-html/build-invalid] duplicate attribute class in consumer output"
    );
}
