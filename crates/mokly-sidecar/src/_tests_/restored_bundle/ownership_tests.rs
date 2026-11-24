//! An origin mirror cannot extend the lifetime of core-owned recipe storage.

use std::sync::Arc;

use serde_json::json;

use crate::client::SidecarClient;

use super::{Script, reply, restore, restored};

#[test]
fn restored_origins_do_not_retain_released_recipe_storage() {
    let source = restore(1, "source", "original");
    let compiled = Arc::downgrade(&restored(&source).compiled);
    let modules = Arc::downgrade(&restored(&source).modules);
    let mut script = Script::new(vec![reply(1, json!(null))]);
    script.client.request(&source).unwrap();
    let retained = (compiled.strong_count(), modules.strong_count());
    drop(source);
    assert_eq!(retained, (1, 1));
    assert_eq!((compiled.strong_count(), modules.strong_count()), (0, 0));
    script.finished(1);
}
