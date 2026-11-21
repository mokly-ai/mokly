//! Full replies keep the established typed result decoding rules.

use serde_json::json;
use serde_json::value::{RawValue, to_raw_value};

use crate::client::SidecarClient;
use crate::wire::{Frame, Response};

use super::{Script, accepted, bundle, reply, restore, restored};

#[test]
fn full_replies_keep_null_defaults_and_ignore_unknown_fields() {
    let source = restore(1, "source", "full");
    let source = restored(&source);
    let mut script = Script::new(vec![reply(
        2,
        json!({
            "generation": "full", "compiled": source.compiled, "modules": source.modules,
            "plan": null, "unmappedDependencyDirectories": null,
            "restoredGeneration": {"unknownBeforeThisChange": true}, "extra": [1, false, null],
        }),
    )]);
    let result = accepted(script.client.request(&bundle(2)));
    assert_eq!(result.generation, "full");
    assert_eq!(
        serde_json::to_value(result.compiled).unwrap(),
        serde_json::to_value(&source.compiled).unwrap()
    );
    assert_eq!(
        serde_json::to_value(result.modules).unwrap(),
        serde_json::to_value(&source.modules).unwrap()
    );
    assert_eq!(result.plan, None);
    assert_eq!(result.unmapped_dependency_directories, None);
    assert_eq!(result.epoch, 0);
    assert_eq!(result.cache, None);
    assert_eq!(result.compile_count, 0);
    script.finished(1);
}

#[test]
fn duplicate_full_fields_keep_the_last_payload_value() {
    let source = restore(1, "source", "full");
    let source = restored(&source);
    let compiled = serde_json::to_string(&source.compiled).unwrap();
    let modules = serde_json::to_string(&source.modules).unwrap();
    let mut script = Script::new(vec![Ok(Frame::Response(Response::Success {
        id: 2,
        result: RawValue::from_string(format!(
            r#"{{"generation":"first","generation":"last","compiled":{compiled},"modules":{modules},"plan":{{"paths":[],"imports":[]}},"plan":null,"unmappedDependencyDirectories":["old"],"unmappedDependencyDirectories":null}}"#
        )).unwrap(),
    }))]);
    let result = accepted(script.client.request(&bundle(2)));
    assert_eq!(result.generation, "last");
    assert_eq!(result.plan, None);
    assert_eq!(result.unmapped_dependency_directories, None);
    script.finished(1);
}

#[test]
fn full_reply_sequences_keep_the_derived_bundle_shape() {
    let source = restore(1, "source", "sequence");
    let source = restored(&source);
    let response = Response::Success {
        id: 2,
        result: to_raw_value(&json!([
            null,
            null,
            source.compiled,
            "sequence",
            source.modules
        ]))
        .unwrap(),
    };
    let expected =
        json!({"generation": "sequence", "compiled": source.compiled, "modules": source.modules});
    let old = response
        .clone()
        .decode_result(&bundle(2))
        .unwrap()
        .into_bundle();
    assert_eq!(serde_json::to_value(old).unwrap(), expected);
    let mut script = Script::new(vec![Ok(Frame::Response(response))]);
    let result = accepted(script.client.request(&bundle(2)));
    assert_eq!(serde_json::to_value(result).unwrap(), expected);
    script.finished(1);
}
