//! Restore references identify exact shared compilation and graph storage.

use std::sync::Arc;

use serde_json::json;

use crate::client::SidecarClient;
use crate::methods::Call;

use super::{Script, accepted, bundle, exact, full, protocol_error, reply, restore, short};

#[test]
fn same_id_resolves_before_bundle_replaces_its_restored_origin() {
    let source = restore(1, "same", "original");
    let mut script = Script::new(vec![
        reply(1, json!(null)),
        short(2, "same", "same"),
        short(3, "next", "same"),
    ]);
    script.client.request(&source).unwrap();
    let result = accepted(script.client.request(&bundle(2)));
    exact(&result, &source, "same");
    protocol_error(script.client.request(&bundle(3)));
    script.finished(3);
}

#[test]
fn duplicate_restores_keep_the_first_recipe_and_do_not_promote_bundle_origins() {
    let source = restore(1, "seed", "first");
    let duplicate = restore(2, "seed", "ignored");
    let loaded = restore(5, "compiled", "ignored-bundle-restore");
    let mut script = Script::new(vec![
        reply(1, json!(null)),
        reply(2, json!(null)),
        short(3, "live", "seed"),
        full(4, "compiled", &duplicate),
        reply(5, json!(null)),
        short(6, "next", "compiled"),
    ]);
    script.client.request(&source).unwrap();
    script.client.request(&duplicate).unwrap();
    exact(
        &accepted(script.client.request(&bundle(3))),
        &source,
        "live",
    );
    accepted(script.client.request(&bundle(4)));
    script.client.request(&loaded).unwrap();
    protocol_error(script.client.request(&bundle(6)));
    script.finished(6);
}

#[test]
fn two_restores_rebuild_each_short_reply_from_its_named_source() {
    let first = restore(1, "first", "first-recipe");
    let mut second = restore(2, "second", "second-recipe");
    let Call::RestoreGeneration(value) = &mut second.call else {
        unreachable!()
    };
    Arc::make_mut(&mut value.compiled).unmapped_dependency_directories = None;
    let mut script = Script::new(vec![
        reply(1, json!(null)),
        reply(2, json!(null)),
        short(3, "second-live", "second"),
        short(4, "first-live", "first"),
    ]);
    script.client.request(&first).unwrap();
    script.client.request(&second).unwrap();
    exact(
        &accepted(script.client.request(&bundle(3))),
        &second,
        "second-live",
    );
    exact(
        &accepted(script.client.request(&bundle(4))),
        &first,
        "first-live",
    );
    script.finished(4);
}
