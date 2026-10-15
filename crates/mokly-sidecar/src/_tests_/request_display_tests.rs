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
        "[mokly-sidecar/render-timeout] entry.tsx#screen (mobile, dark) exceeded 71ms"
    );
}
