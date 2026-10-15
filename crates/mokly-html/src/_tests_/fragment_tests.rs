//! Sidecar seams preserve scope, authenticate markers, and rebase cached identities.

use std::sync::Arc;

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::material::{instance_key, props_key, slot_key};
use mokly_model::usage::{
    CatalogueUsage, ComponentInputOwner, ComponentInstanceRecord, ComponentSlotRecord,
};
use mokly_model::wire_props;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::composition::{ComposeRequest, Composer, HtmlComposer};
use crate::fragment::{Fragment, FragmentMarker, FragmentMarkerKind, FragmentRendererMock};
use crate::serialize;

use super::support;

#[test]
fn supplied_html_slots_use_the_placeholder_scope_and_the_supplier_props() {
    let catalogue = support::prepared(
        "<mokly-ignore-scope enabled=\"false\"><ui-js label=\"Receiver\"><mokly-ignore id=\"noise\"><b>{{label}}</b></mokly-ignore></ui-js></mokly-ignore-scope>",
    );
    let renderer = Arc::new(Unimock::new(FragmentRendererMock::render.next_call(matching!((request) if !request.ignore_enabled && request.slots.contains_key("children"))).answers(&|_, request| Ok(Fragment { html: format!("<section><mokly-slot name=\"children\" token=\"{}\" ignore-scope=\"enabled\"></mokly-slot></section>", request.slots["children"]), ..Default::default() }))));
    let entry = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap();
    let composer: &dyn Composer = &HtmlComposer {
        fragments: renderer,
    };
    let document = composer
        .compose(&ComposeRequest {
            catalogue: &catalogue,
            entry,
            viewport: Viewport::Mobile,
            color_scheme: ColorScheme::Light,
            stylesheets: Vec::new(),
        })
        .unwrap();
    let html = serialize::html(&document.tree);
    assert!(html.contains("<b>Supplier</b>"));
    assert!(!html.contains("Receiver"));
    assert!(format!("{:?}", document.tree).contains("Ignore"));
    assert!(!html.contains("mokly-ignore"));
    insta::assert_snapshot!(html);
}

#[test]
fn unknown_crossing_and_unconsumed_fragment_markers_fail() {
    for html in [
        "<!--mokly-unknown:start id=\"x\"-->",
        "<!--mokly-ignore:end id=\"x\"-->",
        "<!--mokly-ignore:start id=\"x\"--><i></i>",
        "<!--mokly-ignore:start id=\"x\"--><!--mokly-ignore:start id=\"y\"--><!--mokly-ignore:end id=\"x\"--><!--mokly-ignore:end id=\"y\"-->",
        "<!--mokly-instance:start id=\"r-0\" path=\"forged\" instance=\"x\" props=\"y\"--><!--mokly-instance:end id=\"r-0\"-->",
        "<section></section>",
    ] {
        let catalogue = support::prepared("<ui-js label=\"Receiver\"><b>{{label}}</b></ui-js>");
        let renderer = Arc::new(Unimock::new(
            FragmentRendererMock::render
                .next_call(matching!(_))
                .returns(Ok(Fragment {
                    html: html.into(),
                    ..Default::default()
                })),
        ));
        let entry = catalogue
            .model
            .entries
            .iter()
            .find(|entry| entry.metadata.path == "home")
            .unwrap();
        let composer: &dyn Composer = &HtmlComposer {
            fragments: renderer,
        };
        assert!(
            composer
                .compose(&ComposeRequest {
                    catalogue: &catalogue,
                    entry,
                    viewport: Viewport::Mobile,
                    color_scheme: ColorScheme::Light,
                    stylesheets: Vec::new()
                })
                .is_err(),
            "{html}"
        );
    }
}

#[test]
fn nested_instance_and_slot_markers_rebase_under_the_core_invocation() {
    let catalogue = support::prepared(
        "<p>{{label}}</p><ui-js label=\"Receiver\" mokly-instance=\"outer\"></ui-js>",
    );
    let props = serde_json::from_value(json!({"label":"Nested"})).unwrap();
    let original = instance_key(&ComponentInputOwner::Entry, None, "inner").unwrap();
    let digest = props_key(&props).unwrap();
    let slot = slot_key(&original, "children").unwrap();
    let result = Fragment {
        markers: vec![
            FragmentMarker {
                id: "r-0".into(),
                parent_id: None,
                kind: FragmentMarkerKind::Instance {
                    key: original.clone(),
                },
            },
            FragmentMarker {
                id: "r-1".into(),
                parent_id: Some("r-0".into()),
                kind: FragmentMarkerKind::Slot { key: slot.clone() },
            },
        ],
        html: format!(
            "<!--mokly-instance:start id=\"r-0\" path=\"components/js\" instance=\"{original}\" props=\"{digest}\"--><article><!--mokly-slot:start id=\"r-1\" instance=\"r-0\" name=\"children\"--><b>Nested slot</b><!--mokly-slot:end id=\"r-1\"--></article><!--mokly-instance:end id=\"r-0\"-->"
        ),
        instances: vec![ComponentInstanceRecord {
            key: original.clone(),
            id: "inner".into(),
            component_id: "components/js".into(),
            owner: ComponentInputOwner::Entry,
            slot_key: None,
            order: 0,
            props: wire_props::encode(&props),
            props_key: digest,
            source: None,
        }],
        slots: vec![ComponentSlotRecord {
            key: slot,
            instance_key: original.clone(),
            name: "children".into(),
            owner: ComponentInputOwner::Entry,
            source_slot_key: None,
        }],
        ..Default::default()
    };
    let renderer = Arc::new(Unimock::new(
        FragmentRendererMock::render
            .next_call(matching!(_))
            .returns(Ok(result)),
    ));
    let entry = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap();
    let composer: &dyn Composer = &HtmlComposer {
        fragments: renderer,
    };
    let document = composer
        .compose(&ComposeRequest {
            catalogue: &catalogue,
            entry,
            viewport: Viewport::Mobile,
            color_scheme: ColorScheme::Light,
            stylesheets: Vec::new(),
        })
        .unwrap();
    let CatalogueUsage::Ready {
        instances,
        slots,
        ranges,
    } = &document.usage
    else {
        panic!("usage not ready")
    };
    let outer = instances
        .iter()
        .find(|instance| instance.id == "outer")
        .unwrap();
    let inner = instances
        .iter()
        .find(|instance| instance.id == "inner")
        .unwrap();
    assert!(
        matches!(&inner.owner, ComponentInputOwner::Instance { instance_key } if instance_key == &outer.key)
    );
    assert_ne!(inner.key, original);
    assert_eq!(slots[0].instance_key, inner.key);
    assert_eq!(ranges.len(), 3);
    assert_eq!(ranges[2].parent_id.as_deref(), Some("r-1"));
    insta::assert_snapshot!(serialize::html(&document.tree));
}
