//! Templates and pre-parsed saved slots must enter completion before building trees.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_model::axes::{ColorScheme, Viewport};
use unimock::{MockFn, Unimock, matching};

use crate::composition::{
    ComposeRequest, Composed, Composer, ComposerMock, CompositionAdmissionMock, HtmlComposer,
};
use crate::fragment::{Fragment, FragmentRendererMock};
use crate::{serialize, support};
use mokly_model::usage::CatalogueUsage;

fn admission() -> (Unimock, Arc<AtomicUsize>, Arc<AtomicUsize>) {
    let entered = Arc::new(AtomicUsize::new(0));
    let handed = Arc::new(AtomicUsize::new(0));
    let mock = Unimock::new((
        CompositionAdmissionMock::enter
            .each_call(matching!())
            .answers_arc(Arc::new({
                let entered = entered.clone();
                move |_| {
                    entered.fetch_add(1, Ordering::SeqCst);
                }
            })),
        CompositionAdmissionMock::root_fragment
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let handed = handed.clone();
                move |_, _, _| {
                    handed.fetch_add(1, Ordering::SeqCst);
                }
            })),
    ))
    .no_verify_in_drop();
    (mock, entered, handed)
}

#[test]
fn template_nested_javascript_never_signals_the_owning_root_handoff() {
    let catalogue = support::prepared("<ui-js label='Child'></ui-js>");
    let provider = Unimock::new(
        FragmentRendererMock::render
            .some_call(matching!(_))
            .returns(Ok(Fragment {
                html: "<p>Child</p>".into(),
                ..Default::default()
            })),
    );
    let (admission, entered, handed) = admission();
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
    let result = composer.compose_admitted(&request, &admission).unwrap();
    assert!(serialize::html(&result.tree).contains("<p>Child</p>"));
    assert_eq!(entered.load(Ordering::SeqCst), 1);
    assert_eq!(handed.load(Ordering::SeqCst), 0);
}

#[test]
fn saved_slot_tree_enters_completion_and_never_yields_after_its_root_fragment() {
    let mut catalogue = support::prepared("");
    catalogue.slot_fragments.insert(
        "components/js".into(),
        BTreeMap::from([("children".into(), support::saved_slot("<p>Saved</p>"))]),
    );
    let provider = Unimock::new(
        FragmentRendererMock::render
            .some_call(matching!(_))
            .answers(&|_, request| Ok(Fragment {
                html: format!("<p>Root</p><mokly-slot name=\"children\" token=\"{}\" ignore-scope=\"enabled\"></mokly-slot>", request.slots["children"]),
                ..Default::default()
            })),
    );
    let (admission, entered, handed) = admission();
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
    let result = composer.compose_admitted(&request, &admission).unwrap();
    assert!(serialize::html(&result.tree).contains("<p>Root</p>"));
    assert!(serialize::html(&result.tree).contains("<p>Saved</p>"));
    assert_eq!(entered.load(Ordering::SeqCst), 1);
    assert_eq!(handed.load(Ordering::SeqCst), 0);
}

#[test]
fn custom_composer_default_enters_completion_before_calling_its_composition() {
    let (admission, entered, handed) = admission();
    let custom = Unimock::new(
        ComposerMock::compose
            .some_call(matching!(_))
            .answers_arc(Arc::new({
                let entered = entered.clone();
                move |_, _| {
                    assert_eq!(entered.load(Ordering::SeqCst), 1);
                    Ok(Composed {
                        tree: vec![],
                        usage: CatalogueUsage::Unavailable,
                        warnings: vec![],
                        resources: vec![],
                        components: vec![],
                        links: vec![],
                    })
                }
            })),
    );
    let catalogue = support::prepared("");
    let result = custom
        .compose_admitted(
            &ComposeRequest {
                catalogue: &catalogue,
                entry: &catalogue.model.entries[0],
                viewport: Viewport::Mobile,
                color_scheme: ColorScheme::Light,
                stylesheets: vec![],
            },
            &admission,
        )
        .unwrap();
    assert_eq!(result.tree.len(), 0);
    assert_eq!(handed.load(Ordering::SeqCst), 0);
    assert_eq!(entered.load(Ordering::SeqCst), 1);
}
