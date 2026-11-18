//! Historical snapshot identities keep their permanent catalogue and base preimage.

use crate::material::{catalogue_key, historical_snapshot_key};

#[test]
fn historical_id_uses_the_permanent_catalogue_base_and_entry_preimage() {
    let identity = catalogue_key("mokly.config.json");
    let first = historical_snapshot_key(&identity, &"a".repeat(40), "screen", "home");
    let second = historical_snapshot_key(&identity, &"b".repeat(40), "screen", "home");
    assert_eq!(first.len(), 64);
    assert_ne!(first, second);
    insta::assert_snapshot!(first);
}
