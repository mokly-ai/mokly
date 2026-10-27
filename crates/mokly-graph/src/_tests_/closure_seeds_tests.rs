//! Renderer seeds keep entry ownership, and stylesheet seeds warn once.

use std::sync::Arc;

use mokly_catalogue::diagnostic::WarningSubject;
use mokly_model::evidence::EvidenceOwner;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::closure::{ClosureBuilder, Walker};
use crate::policy::{PublicFile, PublicPolicyMock};
use crate::public_denial::PublicDenial;
use crate::reference_index::MemoryReferenceIndex;

use super::queue;

const ROUTE: &str = "home/index.mobile.html";
const MESSAGE: &str = "renderer resource \"styles/theme.css\" is a stylesheet and supplies no CSS evidence. Import the CSS or declare it in stylesheets instead.";

fn seeds(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| value.to_string()).collect()
}

#[test]
fn every_seed_is_queued_with_the_entry_as_owner() {
    let (queued, _) = queue(ROUTE, &seeds(&["assets/font.woff2", "styles/theme.css"]));
    let urls: Vec<_> = queued
        .iter()
        .map(|(source, reference)| (source.as_str(), reference.url.as_str()))
        .collect();
    assert_eq!(
        urls,
        [
            ("static/index.html", "assets/font.woff2"),
            ("static/index.html", "styles/theme.css"),
        ]
    );
    assert!(queued.iter().all(|(_, reference)| {
        reference.owner == EvidenceOwner::Entry
            && !reference.ignored
            && reference.instance_key.is_none()
    }));
}

#[test]
fn a_stylesheet_seed_warns_once_for_the_view() {
    let (_, warnings) = queue(
        ROUTE,
        &seeds(&["styles/theme.css", "assets/font.woff2", "styles/theme.css"]),
    );
    assert_eq!(warnings.len(), 1);
    assert_eq!(warnings[0].code, "stylesheet-owner");
    assert_eq!(warnings[0].subject, WarningSubject::Route(ROUTE.into()));
    assert_eq!(warnings[0].message, MESSAGE);
}

#[test]
fn a_query_does_not_hide_a_stylesheet_seed() {
    let (_, warnings) = queue(ROUTE, &seeds(&["styles/theme.css?v=2"]));
    assert_eq!(warnings.len(), 1);
    assert!(warnings[0].message.contains("\"styles/theme.css?v=2\""));
}

#[test]
fn other_files_and_external_urls_do_not_warn() {
    let (queued, warnings) = queue(
        ROUTE,
        &seeds(&[
            "assets/font.woff2",
            "assets/theme.css.map",
            "https://cdn.example/theme.css",
        ]),
    );
    assert_eq!(queued.len(), 3);
    assert!(warnings.is_empty());
}

fn walker(policy: Unimock, tree: Unimock) -> Walker {
    Walker {
        observer: None,
        tree: Arc::new(tree),
        policy: Arc::new(policy),
        generated: Arc::new(Unimock::new(())),
        index: Arc::new(MemoryReferenceIndex::default()),
    }
}

#[test]
fn a_public_stylesheet_seed_enters_the_closure_with_the_warning() {
    let policy = Unimock::new(
        PublicPolicyMock::check
            .next_call(matching!("styles/theme.css"))
            .returns(Ok(PublicFile {
                path: "styles/theme.css".into(),
                absolute: "/repo/styles/theme.css".into(),
            })),
    );
    let tree = Unimock::new(
        SourceTreeMock::read_public
            .next_call(matching!(_))
            .returns(Ok(b"body { color: red; }".to_vec())),
    );
    let closure = walker(policy, tree)
        .collect(ROUTE, &[], &seeds(&["styles/theme.css"]))
        .unwrap();
    assert!(closure.files.contains("styles/theme.css"));
    assert_eq!(closure.warnings.len(), 1);
    assert_eq!(closure.warnings[0].code, "stylesheet-owner");
    assert_eq!(closure.warnings[0].message, MESSAGE);
}

#[test]
fn a_protected_stylesheet_seed_fails_without_a_warning() {
    let policy = Unimock::new(
        PublicPolicyMock::check
            .next_call(matching!("styles/theme.css"))
            .returns(Err(PublicDenial::Missing)),
    );
    let result =
        walker(policy, Unimock::new(())).collect(ROUTE, &[], &seeds(&["styles/theme.css"]));
    assert!(result.is_err());
}
