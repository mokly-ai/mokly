//! Preparation is root-only and excludes templates, saved trees, and custom composers.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::composition::{ComposeRequest, Composed, Composer, ComposerMock, HtmlComposer};
use crate::fragment::{Fragment, FragmentRendererMock};
use crate::{serialize, support};

#[test]
fn template_nested_javascript_never_prepares_the_owning_root() {
    let catalogue = support::prepared("<ui-js label='Child'></ui-js>");
    let provider = Unimock::new(
        FragmentRendererMock::render
            .some_call(matching!(_))
            .returns(Ok(Fragment {
                html: "<p>Child</p>".into(),
                ..Default::default()
            })),
    );
    let composer = HtmlComposer {
        fragments: Arc::new(provider.clone()),
    };
    let request = ComposeRequest {
        catalogue: &catalogue,
        entry: catalogue
            .model
            .entries
            .iter()
            .find(|entry| entry.metadata.path == "home")
            .unwrap(),
        viewport: Viewport::Mobile,
        color_scheme: ColorScheme::Light,
        stylesheets: vec![],
    };
    assert!(!composer.can_prepare_root(&catalogue, request.entry));
    assert!(composer.prepare_root(&request).unwrap().is_none());
    let result = composer.compose(&request).unwrap();
    assert!(serialize::html(&result.tree).contains("<p>Child</p>"));
}

#[test]
fn saved_slot_tree_never_prepares_or_yields_after_its_root_fragment() {
    let mut catalogue = support::prepared("");
    catalogue.slot_fragments.insert(
        "components/js".into(),
        BTreeMap::from([("children".into(), support::saved_slot("<p>Saved</p>"))]),
    );
    let provider = Unimock::new(FragmentRendererMock::render.some_call(matching!(_)).answers(&|_, request| Ok(Fragment {
        html: format!("<p>Root</p><mokly-slot name=\"children\" token=\"{}\" ignore-scope=\"enabled\"></mokly-slot>", request.slots["children"]), ..Default::default() })));
    let composer = HtmlComposer {
        fragments: Arc::new(provider.clone()),
    };
    let request = ComposeRequest {
        catalogue: &catalogue,
        entry: catalogue
            .model
            .entries
            .iter()
            .find(|entry| entry.metadata.path == "components/js")
            .unwrap(),
        viewport: Viewport::Mobile,
        color_scheme: ColorScheme::Light,
        stylesheets: vec![],
    };
    assert!(!composer.can_prepare_root(&catalogue, request.entry));
    assert!(composer.prepare_root(&request).unwrap().is_none());
    let result = composer.compose(&request).unwrap();
    assert!(serialize::html(&result.tree).contains("<p>Root</p>"));
    assert!(serialize::html(&result.tree).contains("<p>Saved</p>"));
}

#[test]
fn custom_composer_default_never_prepares_a_root_or_bypasses_its_composition() {
    let custom = Unimock::new(ComposerMock::compose.some_call(matching!(_)).returns(Ok(
        Composed {
            tree: vec![],
            usage: CatalogueUsage::Unavailable,
            warnings: vec![],
            resources: vec![],
            components: vec![],
            links: vec![],
        },
    )));
    let catalogue = support::prepared("");
    let request = ComposeRequest {
        catalogue: &catalogue,
        entry: &catalogue.model.entries[0],
        viewport: Viewport::Mobile,
        color_scheme: ColorScheme::Light,
        stylesheets: vec![],
    };
    assert!(!custom.can_prepare_root(&catalogue, request.entry));
    assert!(custom.prepare_root(&request).unwrap().is_none());
    let result = custom.compose(&request).unwrap();
    assert_eq!(result.tree.len(), 0);
}

#[test]
fn javascript_root_is_statically_eligible_without_rendering() {
    let catalogue = support::prepared("");
    let calls = Arc::new(AtomicUsize::new(0));
    let provider = Unimock::new(
        FragmentRendererMock::render
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let calls = calls.clone();
                move |_, _| {
                    calls.fetch_add(1, Ordering::SeqCst);
                    Ok(Fragment::default())
                }
            }))
            .at_least_times(0),
    )
    .no_verify_in_drop();
    let composer = HtmlComposer {
        fragments: Arc::new(provider.clone()),
    };
    let entry = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "components/js")
        .unwrap();
    assert!(composer.can_prepare_root(&catalogue, entry));
    assert_eq!(calls.load(Ordering::SeqCst), 0);
}

#[test]
fn variant_with_a_parent_template_never_prepares_a_root() {
    let catalogue = support::prepared("");
    let mut entry = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap()
        .clone();
    entry.metadata.path = "home/variant".into();
    entry.metadata.variant_of = Some("home".into());
    let composer = HtmlComposer {
        fragments: Arc::new(Unimock::new(())),
    };
    assert!(!composer.can_prepare_root(&catalogue, &entry));
    let request = ComposeRequest {
        catalogue: &catalogue,
        entry: &entry,
        viewport: Viewport::Mobile,
        color_scheme: ColorScheme::Light,
        stylesheets: vec![],
    };
    assert!(composer.prepare_root(&request).unwrap().is_none());
}
