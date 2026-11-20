//! Store deduplication preserves every canonical input and never retries a failed attempt.

use std::path::Path;
use std::sync::Arc;

use serde_json::json;

use crate::error::{Error, RemoteCode, RequestCode};
use crate::methods::Call;
use crate::pool::SidecarPool;

use super::calls::{call, render};
use super::support::Harness;

#[test]
fn store_deduplication_compares_props_entry_axes_slots_ignore_and_render_kind() {
    let harness = Harness::plain(1);
    harness.head("g", &[]);
    let base = json!({"method":"renderComponent","params":{
        "generation":"g","handle":"card.tsx#Card", "entry":{"path":"card","title":"Card"},
        "props":{"large":9007199254740993_u64, "nested":{"zero":-0.0}}, "viewport":"mobile","colorScheme":"light",
        "slots":{"children":{"kind":"placeholder","token":"opaque"}},"ignoreScope":"enabled"
    }});
    let mut calls = vec![base.clone()];
    for (field, value) in [
        (
            "props",
            json!({"large":9007199254740992_u64, "nested":{"zero":-0.0}}),
        ),
        (
            "props",
            json!({"large":9007199254740993_u64, "nested":{"zero":0.0}}),
        ),
        ("entry", json!({"path":"card/variant","title":"Variant"})),
        ("viewport", json!("desktop")),
        ("colorScheme", json!("dark")),
        (
            "slots",
            json!({"children":{"kind":"saved","handle":"current:slot"}}),
        ),
        ("ignoreScope", json!("disabled")),
    ] {
        let mut changed = base.clone();
        changed["params"][field] = value;
        calls.push(changed);
    }
    let mut screen = base;
    screen["method"] = json!("renderScreen");
    calls.push(screen);
    for value in calls {
        let call: Call = serde_json::from_value(value).unwrap();
        harness
            .pool
            .record_served_render(Path::new("/head"), call.clone());
        harness.pool.record_served_render(Path::new("/head"), call);
    }
    harness.pool.schedule_head_return();
    assert_eq!(harness.maintain(), 1);
    assert_eq!(
        harness.events.quiet(0).len(),
        9,
        "only exact equal store inputs share one contribution"
    );
    harness.pool.abort().unwrap();
}

#[test]
fn a_failed_existing_head_warmup_is_not_retried_by_the_next_same_generation_publication() {
    let harness = Harness::new(
        1,
        Arc::new(|event| {
            if *event == call(0, "failing export default") {
                return Err(Error::Remote {
                    code: RemoteCode::Request(RequestCode::BundleFailed),
                    message: "injected".into(),
                });
            }
            Ok(())
        }),
    );
    harness.head("g", &[]);
    harness
        .pool
        .record_served_render(Path::new("/head"), render("g", "failing"));
    harness.pool.schedule_head_return();
    assert_eq!(harness.maintain(), 1);
    assert_eq!(harness.events.quiet(0), ["failing export default"]);
    let failed = harness.events.read();
    harness.pool.schedule_head_return();
    assert_eq!(
        harness.maintain(),
        0,
        "the failed process gets no second attempt"
    );
    assert_eq!(harness.events.read(), failed);
    harness.pool.abort().unwrap();
}
