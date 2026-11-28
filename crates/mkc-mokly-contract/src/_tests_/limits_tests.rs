//! Quota construction always clamps, including artifacts parsed independently.

use crate::error::{Error, Limit};
use crate::index::CatalogueIndex;
use crate::inventory::Inventory;
use crate::limits::{Limits, Quotas};

#[test]
fn construction_clamps_every_quota_and_copies_cannot_mutate_limits() {
    let limits = Limits::lowered(Quotas {
        compressed: u64::MAX,
        decompressed: u64::MAX,
        declared: u64::MAX,
        file: u64::MAX,
        files: usize::MAX,
        manifest: u64::MAX,
        inventory: u64::MAX,
        index: u64::MAX,
        path: usize::MAX,
        path_segments: usize::MAX,
        prefixes: usize::MAX,
    });
    assert_eq!(limits, Limits::default());
    let mut copy = limits.quotas();
    copy.inventory = u64::MAX;
    assert_ne!(limits.quotas(), copy);
}

#[test]
fn standalone_artifact_limits_are_inclusive_and_lowerable() {
    let inventory = br#"{"schemaVersion":3,"files":[]}"#;
    let index = include_bytes!("../../fixtures/index-v9.json");
    let limits = Limits::lowered(Quotas {
        inventory: inventory.len() as u64,
        index: index.len() as u64,
        ..Quotas::default()
    });
    assert!(Inventory::parse(inventory, limits).is_ok());
    assert!(CatalogueIndex::parse(index, limits).is_ok());
    let limits = Limits::lowered(Quotas {
        inventory: inventory.len() as u64 - 1,
        index: index.len() as u64 - 1,
        ..Quotas::default()
    });
    assert!(matches!(
        Inventory::parse(inventory, limits),
        Err(Error::TooLarge {
            limit: Limit::Inventory
        })
    ));
    assert!(matches!(
        CatalogueIndex::parse(index, limits),
        Err(Error::TooLarge {
            limit: Limit::Index
        })
    ));
}
