//! Dispose and process loss end restore references without a fallback request.

use serde_json::json;

use crate::client::SidecarClient;
use crate::error::Error;
use crate::methods::{Call, Generation};

use super::{Script, accepted, bundle, exact, protocol_error, reply, request, restore, short};

#[test]
fn dispose_before_a_short_reply_rejects_its_restore_reference() {
    let source = restore(1, "seed", "original");
    let mut script = Script::new(vec![
        reply(1, json!(null)),
        short(2, "live", "seed"),
        reply(3, json!(null)),
        short(4, "next", "seed"),
    ]);
    script.client.request(&source).unwrap();
    exact(
        &accepted(script.client.request(&bundle(2))),
        &source,
        "live",
    );
    script
        .client
        .request(&request(
            3,
            Call::Dispose(Generation {
                generation: "seed".into(),
            }),
        ))
        .unwrap();
    protocol_error(script.client.request(&bundle(4)));
    script.finished(4);
}

#[test]
fn an_unknown_restore_reference_cannot_use_the_last_loaded_recipe() {
    let source = restore(1, "seed", "original");
    let mut script = Script::new(vec![
        reply(1, json!(null)),
        short(2, "live", "seed"),
        short(3, "next", "unknown"),
    ]);
    script.client.request(&source).unwrap();
    exact(
        &accepted(script.client.request(&bundle(2))),
        &source,
        "live",
    );
    protocol_error(script.client.request(&bundle(3)));
    script.finished(3);
}

#[test]
fn a_replacement_client_cannot_resolve_the_lost_process_restore() {
    let source = restore(1, "seed", "original");
    let mut lost = Script::new(vec![
        reply(1, json!(null)),
        short(2, "live", "seed"),
        Err(Error::Crashed),
    ]);
    lost.client.request(&source).unwrap();
    exact(&accepted(lost.client.request(&bundle(2))), &source, "live");
    assert!(matches!(
        lost.client.request(&bundle(3)),
        Err(Error::Crashed)
    ));
    lost.finished(3);
    let mut replacement = Script::new(vec![short(4, "next", "seed")]);
    protocol_error(replacement.client.request(&bundle(4)));
    replacement.finished(1);
}
