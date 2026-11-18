//! Plans persist beside compiled code without changing program restore envelopes.

use std::io::Cursor;
use std::sync::Arc;

use mokly_sidecar::resolution_plan::{PlannedImport, PlannedImportKind, ResolutionPlan};
use mokly_sidecar::reusable_recipe::disk_seed_request;

use crate::bundle_codec::Codec;
use crate::bundle_fixture::{params, recipe};

#[test]
fn a_disk_entry_keeps_its_optional_plan_but_an_unchanged_restore_never_carries_it() {
    let original = recipe();
    let restore = serde_json::to_vec(&disk_seed_request(&original)).unwrap();
    let plan = Arc::new(ResolutionPlan {
        paths: vec!["/repo/entry.ts".into(), "/repo/target.ts".into()],
        imports: vec![PlannedImport(
            0,
            "./target.ts".into(),
            PlannedImportKind::ImportStatement,
            1,
            true,
        )],
    });
    let saved = original.with_plan(Some(plan.clone()));
    let encoded = Codec::default().encode(&saved, "current").unwrap().unwrap();
    let loaded = Codec::default()
        .decode(
            &mut Cursor::new(&encoded),
            encoded.len() as u64,
            &params(),
            "current",
        )
        .unwrap();
    assert_eq!(loaded.plan(), Some(&plan));
    assert_eq!(
        serde_json::to_vec(&disk_seed_request(&loaded)).unwrap(),
        restore
    );
    let without = recipe().with_plan(None);
    let baseline = Codec::default()
        .encode(&without, "current")
        .unwrap()
        .unwrap();
    let constrained = Codec {
        file_bytes: baseline.len(),
        frame_bytes: restore.len(),
    };
    let encoded = constrained.encode(&loaded, "current").unwrap().unwrap();
    let loaded = constrained
        .decode(
            &mut Cursor::new(&encoded),
            encoded.len() as u64,
            &params(),
            "current",
        )
        .unwrap();
    assert_eq!(loaded.plan(), None);
    assert_eq!(loaded.compiled().identity, "identity");
}
