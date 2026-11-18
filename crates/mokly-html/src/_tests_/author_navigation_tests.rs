//! Shared fragment, link-resolution, and explicit-instance author cases.

use std::sync::Arc;

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::usage::CatalogueUsage;
use serde_json::Value;
use unimock::Unimock;

use crate::composition::{ComposeRequest, Composer, HtmlComposer};
use crate::diagnostic_code::Code;
use crate::error::HtmlError;
use crate::{links, parse};

use super::support;

struct Cases {
    fragments: Vec<GrammarCase>,
    instances: Vec<GrammarCase>,
    links: Vec<LinkCase>,
}

struct GrammarCase {
    value: String,
    valid: bool,
}

struct LinkCase {
    value: String,
    resolved: Option<String>,
}

fn cases() -> Cases {
    let document: Value = serde_json::from_str(include_str!(
        "../../../../packages/viewer/tests/fixtures/author-checks/navigation.json"
    ))
    .unwrap();
    Cases {
        fragments: grammar_cases(&document["fragments"]),
        instances: grammar_cases(&document["instances"]),
        links: document["links"]
            .as_array()
            .unwrap()
            .iter()
            .map(|case| LinkCase {
                value: case["value"].as_str().unwrap().into(),
                resolved: match &case["resolved"] {
                    Value::Null => None,
                    Value::String(value) => Some(value.clone()),
                    value => panic!("invalid resolved-path fixture: {value}"),
                },
            })
            .collect(),
    }
}

fn grammar_cases(value: &Value) -> Vec<GrammarCase> {
    value
        .as_array()
        .unwrap()
        .iter()
        .map(|case| GrammarCase {
            value: case["value"].as_str().unwrap().into(),
            valid: case["valid"].as_bool().unwrap(),
        })
        .collect()
}

fn failure_code(error: HtmlError) -> Code {
    match error {
        HtmlError::Attempt { source, .. }
        | HtmlError::Located { source, .. }
        | HtmlError::Route { source, .. } => failure_code(*source),
        HtmlError::Invalid { code, .. } => code,
        error => panic!("unexpected error: {error}"),
    }
}

#[test]
fn shared_fragments_accept_alphabetic_numeric_and_combining_characters() {
    for case in cases().fragments {
        assert_eq!(
            links::valid_fragment(&case.value),
            case.valid,
            "{}",
            case.value
        );
    }
}

#[test]
fn shared_links_resolve_in_the_source_folder_and_stay_inside_the_catalogue() {
    let prepared = support::prepared_html("<p>Source</p>", "<p>Note</p>");
    let mut source = prepared
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap()
        .clone();
    source.metadata.path = "account/home".into();
    let entries: Vec<_> = ["account/home", "details", "account/details"]
        .iter()
        .map(|path| {
            let mut entry = source.clone();
            entry.metadata.path = (*path).into();
            entry
        })
        .collect();
    for case in cases().links {
        let mut nodes = parse::html(DeliveredHtml::fragment(&format!(
            "<a href=\"mock:{}\">Go</a>",
            case.value
        )));
        let resolved = links::rewrite(
            &mut nodes,
            &entries,
            &source,
            "account/home/index.mobile.html",
            Viewport::Mobile,
            ColorScheme::Light,
        )
        .map(|references| {
            references
                .into_iter()
                .map(|reference| reference.target)
                .collect::<Vec<_>>()
        })
        .map_err(failure_code);
        assert_eq!(
            resolved,
            case.resolved
                .map(|path| vec![path])
                .ok_or(Code::BuildInvalid),
            "{}",
            case.value
        );
    }
}

#[test]
fn shared_explicit_instance_ids_accept_device_names_without_changing_paths() {
    for case in cases().instances {
        let body = format!("<ui-note mokly-instance=\"{}\"></ui-note>", case.value);
        let prepared = support::prepared_html(&body, "<p>Note</p>");
        let entry = prepared
            .model
            .entries
            .iter()
            .find(|entry| entry.metadata.path == "home")
            .unwrap();
        let composer = HtmlComposer {
            fragments: Arc::new(Unimock::new(())),
        };
        let result = composer.compose(&ComposeRequest {
            catalogue: &prepared,
            entry,
            viewport: Viewport::Mobile,
            color_scheme: ColorScheme::Light,
            stylesheets: Vec::new(),
        });
        let ids = result
            .map(|document| match document.usage {
                CatalogueUsage::Ready { instances, .. } => instances
                    .into_iter()
                    .map(|instance| instance.id)
                    .collect::<Vec<_>>(),
                _ => panic!("expected ready usage"),
            })
            .map_err(failure_code);
        let expected = case
            .valid
            .then_some(vec![case.value])
            .ok_or(Code::HtmlAttribute);
        assert_eq!(ids, expected);
    }
}
