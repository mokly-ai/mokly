//! Record-only adapters preserve exact call inputs and bypass fragment memo work.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_graph::fragments::MemoFragments;
use mokly_graph::key::NodeKey;
use mokly_graph::render_inputs::RenderKeys;
use mokly_html::fragment::{FragmentRenderer, FragmentRequest, RenderKind};
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_sidecar::pool::PoolMock;
use serde_json::{Value, json};
use unimock::{MockFn, Unimock, matching};

use crate::fragments::Fragments;

#[test]
fn stored_fragment_calls_keep_source_root_current_generation_and_exact_transport_inputs() {
    let recorded = Arc::new(Mutex::new(Vec::new()));
    let captured = recorded.clone();
    let pool = Unimock::new(
        PoolMock::record_served_render
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, root, call| {
                captured
                    .lock()
                    .unwrap()
                    .push((root.to_path_buf(), serde_json::to_value(call).unwrap()));
            })),
    );
    let memo = MemoFragments::new(
        Arc::new(RenderKeys::whole(NodeKey("inputs".into()))),
        Arc::new(Fragments {
            _lease: None,
            pool: Arc::new(pool.clone()),
            generation: "current".into(),
            source_root: "/exact/head".into(),
        }),
        Arc::new(Unimock::new(())),
    );
    for kind in [
        RenderKind::Screen,
        RenderKind::Component,
        RenderKind::Story,
        RenderKind::Page,
    ] {
        memo.record_served(&FragmentRequest {
            handle: "current.tsx#Variant".into(),
            entry_path: "card/variant".into(),
            entry_title: "Variant title".into(),
            kind,
            props: serde_json::from_value(
                json!({"code":"a/b~c", "large":9007199254740993_u64, "nested":{"key":1.25}}),
            )
            .unwrap(),
            viewport: Viewport::Mobile,
            color_scheme: ColorScheme::Dark,
            ignore_enabled: false,
            slots: BTreeMap::from([
                ("children".into(), "opaque".into()),
                ("footer".into(), "replaced".into()),
            ]),
            saved_slots: BTreeMap::from([("footer".into(), "current:footer".into())]),
        });
    }
    let actual = recorded.lock().unwrap();
    assert_eq!(
        actual
            .iter()
            .map(|(root, _)| root.to_str().unwrap())
            .collect::<Vec<_>>(),
        ["/exact/head", "/exact/head", "/exact/head", "/exact/head"]
    );
    let common = json!({"generation":"current", "handle":"current.tsx#Variant",
        "entry":{"path":"card/variant", "title":"Variant title"},
        "props":{"code":"a/b~c", "large":9_007_199_254_740_992.0, "nested":{"key":1.25}},
        "viewport":"mobile", "colorScheme":"dark"});
    let mut component = common.clone();
    component["slots"] = json!({"children":{"kind":"placeholder","token":"opaque"},
        "footer":{"kind":"saved","handle":"current:footer"}});
    component["ignoreScope"] = json!("disabled");
    assert_eq!(
        actual
            .iter()
            .map(|(_, call)| call.clone())
            .collect::<Vec<Value>>(),
        [
            json!({"method":"renderScreen","params":common}),
            json!({"method":"renderComponent","params":component}),
            json!({"method":"renderStory","params":{"generation":"current", "storyId":"current.tsx#Variant",
            "props":{"code":"a/b~c", "large":9_007_199_254_740_992.0, "nested":{"key":1.25}},
            "viewport":"mobile", "colorScheme":"dark"}}),
            json!({"method":"renderPage","params":{"generation":"current","handle":"current.tsx#Variant"}}),
        ]
    );
}
