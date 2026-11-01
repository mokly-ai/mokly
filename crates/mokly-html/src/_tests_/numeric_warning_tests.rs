//! HTML composition warnings retain component invocation identities.

use std::sync::Arc;

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::EntryContent;
use mokly_model::material::{instance_key, props_key};
use mokly_model::usage::ComponentInputOwner;
use mokly_model::wire_props;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::composition::{ComposeRequest, Composer, HtmlComposer};
use crate::fragment::{Fragment, FragmentMarker, FragmentMarkerKind, FragmentRendererMock};

use super::support;

fn compose_html(
    catalogue: &mokly_catalogue::preparation::PreparedCatalogue,
) -> crate::composition::Composed {
    let entry = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap();
    HtmlComposer {
        fragments: Arc::new(Unimock::new(())),
    }
    .compose(&ComposeRequest {
        catalogue,
        entry,
        viewport: Viewport::Mobile,
        color_scheme: ColorScheme::Light,
        stylesheets: Vec::new(),
    })
    .unwrap()
}

#[test]
fn html_invocations_name_component_and_instance_for_each_unsafe_prop() {
    let catalogue = support::prepared_html_count(
        "<ui-note count='9007199254740993'></ui-note><ui-note mokly-instance='second' count='9007199254740995'></ui-note>",
        "<p>{{count}}</p>",
        "",
    );
    let document = compose_html(&catalogue);
    let messages: Vec<_> = document
        .warnings
        .iter()
        .map(|warning| warning.message.as_str())
        .collect();
    assert_eq!(
        messages,
        vec![
            "component \"note\" instance \"note\" prop \"/count\" is outside the JavaScript safe integer range and uses the nearest binary64 value",
            "component \"note\" instance \"second\" prop \"/count\" is outside the JavaScript safe integer range and uses the nearest binary64 value",
        ]
    );
}

#[test]
fn html_entry_and_invocation_warnings_remain_separate() {
    let catalogue = support::prepared_html_count(
        "{{count}}<ui-note count='9007199254740993'></ui-note>",
        "<p>{{count}}</p>",
        "props: {count: 9007199254740993}\n",
    );
    let document = compose_html(&catalogue);
    assert!(catalogue.warnings.iter().any(|warning| {
        warning.message == "prop \"/count\" is outside the JavaScript safe integer range and uses the nearest binary64 value"
    }));
    assert_eq!(document.warnings.len(), 1);
    assert_eq!(
        document.warnings[0].message,
        "component \"note\" instance \"note\" prop \"/count\" is outside the JavaScript safe integer range and uses the nearest binary64 value"
    );
}

#[test]
fn javascript_instance_drafts_name_their_component_and_id() {
    let mut catalogue = support::prepared("<p>Home</p>");
    let component = catalogue
        .model
        .entries
        .iter_mut()
        .find(|entry| entry.metadata.path == "components/js")
        .unwrap();
    if let EntryContent::Component { visual, .. } = &mut component.content {
        visual.prop_schema = serde_json::from_value(json!({
            "type":"object","additionalProperties":false,
            "properties":{"count":{"type":"integer"}}
        }))
        .unwrap();
        visual.props = serde_json::from_value(json!({"count": 1})).unwrap();
    } else {
        panic!("expected component entry");
    }
    let props = serde_json::from_value(json!({"count": 9007199254740993_u64})).unwrap();
    let key = instance_key(&ComponentInputOwner::Entry, None, "draft").unwrap();
    let props_key = props_key(&props).unwrap();
    let renderer = Arc::new(Unimock::new(
        FragmentRendererMock::render
            .next_call(matching!(_))
            .returns(Ok(Fragment {
                html: format!(
                    "<!--mokly-instance:start id=\"r-0\" path=\"components/js\" instance=\"{key}\" props=\"{props_key}\"--><p>Draft</p><!--mokly-instance:end id=\"r-0\"-->"
                ),
                markers: vec![FragmentMarker {
                    id: "r-0".into(),
                    parent_id: None,
                    kind: FragmentMarkerKind::Instance { key: key.clone() },
                }],
                instances: vec![mokly_model::usage::ComponentInstanceRecord {
                    key,
                    id: "draft".into(),
                    component_id: "components/js".into(),
                    owner: ComponentInputOwner::Entry,
                    slot_key: None,
                    order: 0,
                    props: wire_props::encode(&props),
                    props_key,
                    source: None,
                }],
                ..Default::default()
            })),
    ));
    let entry = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "components/js")
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
    assert_eq!(document.warnings.len(), 1);
    assert_eq!(
        document.warnings[0].message,
        "component \"components/js\" instance \"draft\" prop \"/count\" is outside the JavaScript safe integer range and uses the nearest binary64 value"
    );
}
