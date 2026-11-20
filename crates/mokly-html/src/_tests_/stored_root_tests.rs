//! A stored root reconstructs canonical inputs without expanding any HTML body.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_catalogue::render_sources::{RenderMethod, RenderSource};
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::EntryContent;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::composition::{ComposeRequest, Composer, HtmlComposer};
use crate::fragment::{FragmentRendererMock, FragmentRequest, RenderKind};

use super::support;

#[test]
fn stored_roots_keep_variant_props_axes_slots_and_current_handles_without_rendering() {
    let mut catalogue = support::prepared("<ui-js label='Nested'></ui-js>");
    let mut variant = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "components/js")
        .unwrap()
        .clone();
    variant.metadata.path = "components/js/large".into();
    variant.metadata.variant_of = Some("components/js".into());
    variant.metadata.title = "Large variant".into();
    let EntryContent::Component { visual, slots, .. } = &mut variant.content else {
        panic!("component fixture");
    };
    visual.props = serde_json::from_value(json!({"label":"Exact variant"})).unwrap();
    slots.push("footer".into());
    catalogue.slot_fragments.insert(
        variant.metadata.path.clone(),
        BTreeMap::from([(
            "children".into(),
            support::saved_slot("<ui-js label='Unexpanded'></ui-js>"),
        )]),
    );
    catalogue.javascript.entries.insert(
        variant.metadata.path.clone(),
        RenderSource {
            handle: "current.tsx#Large".into(),
            method: RenderMethod::Component,
            slots: BTreeMap::from([("footer".into(), "current:footer".into())]),
            stylesheets: vec![],
        },
    );
    let recorded = Arc::new(Mutex::new(Vec::new()));
    let captured = recorded.clone();
    let composer = HtmlComposer {
        fragments: Arc::new(Unimock::new(
            FragmentRendererMock::record_served
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, request| {
                    captured.lock().unwrap().push(request.clone())
                }))
                .at_least_times(0),
        )),
    };
    composer.record_served(&ComposeRequest {
        catalogue: &catalogue,
        entry: &variant,
        viewport: Viewport::Desktop,
        color_scheme: ColorScheme::Dark,
        stylesheets: vec![],
    });
    assert_eq!(
        *recorded.lock().unwrap(),
        [FragmentRequest {
            handle: "current.tsx#Large".into(),
            entry_path: "components/js/large".into(),
            entry_title: "Large variant".into(),
            kind: RenderKind::Component,
            props: serde_json::from_value(json!({"label":"Exact variant"})).unwrap(),
            viewport: Viewport::Desktop,
            color_scheme: ColorScheme::Dark,
            ignore_enabled: true,
            slots: BTreeMap::from([(
                "children".into(),
                "3f54b23236a5261b5b78bf12d75241f13220ce9c25873cc6bf1fd129a974cc0d".into()
            )]),
            saved_slots: BTreeMap::from([("footer".into(), "current:footer".into())]),
        }]
    );
}

#[test]
fn stored_root_kind_selection_records_screens_stories_and_pages_but_no_html_body_calls() {
    let mut catalogue = support::prepared("<ui-js label='Nested'></ui-js>");
    let home = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap()
        .clone();
    let screen = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "components/js")
        .unwrap();
    let EntryContent::Component { visual, .. } = &screen.content else {
        panic!("component fixture")
    };
    let mut screen = screen.clone();
    screen.content = EntryContent::Screen {
        visual: visual.clone(),
        address: None,
        use_case_paths: vec![],
    };
    let recorded = Arc::new(Mutex::new(Vec::new()));
    let captured = recorded.clone();
    let composer = HtmlComposer {
        fragments: Arc::new(Unimock::new(
            FragmentRendererMock::record_served
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, request| {
                    captured.lock().unwrap().push(request.clone())
                }))
                .at_least_times(0),
        )),
    };
    for entry in [&home, &screen] {
        composer.record_served(&ComposeRequest {
            catalogue: &catalogue,
            entry,
            viewport: Viewport::Mobile,
            color_scheme: ColorScheme::Light,
            stylesheets: vec![],
        });
    }
    catalogue.javascript.entries.insert(
        screen.metadata.path.clone(),
        RenderSource {
            handle: "stories.tsx#Saved".into(),
            method: RenderMethod::Story,
            ..Default::default()
        },
    );
    composer.record_served(&ComposeRequest {
        catalogue: &catalogue,
        entry: &screen,
        viewport: Viewport::Mobile,
        color_scheme: ColorScheme::Light,
        stylesheets: vec![],
    });
    catalogue.javascript.entries.remove(&screen.metadata.path);
    screen.content = EntryContent::Page;
    composer.record_served(&ComposeRequest {
        catalogue: &catalogue,
        entry: &screen,
        viewport: Viewport::Desktop,
        color_scheme: ColorScheme::Light,
        stylesheets: vec![],
    });
    let actual = recorded.lock().unwrap();
    assert_eq!(
        actual
            .iter()
            .map(|request| (request.kind.clone(), request.handle.as_str()))
            .collect::<Vec<_>>(),
        [
            (RenderKind::Screen, "specs/shared.mockup.tsx#default"),
            (RenderKind::Story, "stories.tsx#Saved"),
            (RenderKind::Page, "specs/shared.mockup.tsx#default"),
        ]
    );
    assert_eq!(
        actual[0].props,
        serde_json::from_value(json!({"label":"Saved"})).unwrap()
    );
    assert_eq!(actual[2].props, BTreeMap::new());
}
