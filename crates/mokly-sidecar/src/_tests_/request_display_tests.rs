//! Attribution keeps bundle-side categories and lowercase public axes.

use serde_json::json;

use crate::error::{Error, FailureKind};
use crate::methods::Call;

#[test]
fn bundle_side_crashes_keep_bundle_failed() {
    for (method, params) in [
        ("cssModules", json!({"generation":"g","classMaps":{}})),
        ("bindings", json!({"generation":"g","entries":{}})),
        ("dispose", json!({"generation":"g"})),
        ("disposeContext", json!({"context":"css"})),
    ] {
        let call: Call = serde_json::from_value(json!({"method":method,"params":params})).unwrap();
        assert!(matches!(FailureKind::for_call(&call), FailureKind::Bundle));
    }
}

#[test]
fn timeout_diagnostic_names_the_entry_axes_and_deadline() {
    let call:Call=serde_json::from_value(json!({"method":"renderScreen","params":{"generation":"g","handle":"entry.tsx#screen","entry":{"path":"screen","title":"Screen"},"props":{},"viewport":"mobile","colorScheme":"dark"}})).unwrap();
    assert!(matches!(FailureKind::for_call(&call), FailureKind::Render));
    assert_eq!(
        Error::RequestTimeout {
            call: Box::new(call),
            deadline_ms: 71
        }
        .to_string(),
        "[mokly-sidecar/render-timeout] entry.tsx export screen (mobile, dark) exceeded 71ms"
    );
}

#[test]
fn render_labels_split_only_the_last_handle_separator() {
    let render = json!({"generation":"g","handle":"dir#name/entry.tsx#screen","entry":{"path":"screen","title":"Screen"},"props":{},"viewport":"mobile","colorScheme":"dark"});
    for (method, params, expected) in [
        (
            "renderScreen",
            render.clone(),
            "dir#name/entry.tsx export screen (mobile, dark)",
        ),
        (
            "renderComponent",
            {
                let mut value = render;
                value["slots"] = json!({});
                value["ignoreScope"] = json!("enabled");
                value
            },
            "dir#name/entry.tsx export screen (mobile, dark)",
        ),
        (
            "renderStory",
            json!({"generation":"g","storyId":"dir#name/entry.tsx#story","props":{},"viewport":"mobile","colorScheme":"dark"}),
            "dir#name/entry.tsx export story (mobile, dark)",
        ),
        (
            "renderPage",
            json!({"generation":"g","handle":"dir#name/page.ts#default"}),
            "dir#name/page.ts export default",
        ),
        (
            "processCss",
            json!({"context":"c","sourceRoot":"/physical/repo","repositoryRoots":[],"moduleResolution":{},"postcss":"postcss.mjs","sourcePath":"styles/input.css","text":""}),
            "postcss.mjs for styles/input.css",
        ),
    ] {
        let call: Call = serde_json::from_value(json!({"method":method,"params":params})).unwrap();
        assert_eq!(call.to_string(), expected);
    }
}
