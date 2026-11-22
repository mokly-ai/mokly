//! Byte limits and identity collisions preserve every retained generation.

use std::collections::BTreeMap;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::assets::File;
use crate::clock::ClockMock;
use crate::comparison_capture::{CapturerMock, MAX_BYTES};
use crate::comparison_store::{Bundle, Comparisons, MemoryComparisons, State, admit};
use crate::comparison_support::{accepted, files, snapshot};
use crate::diagnostics::DiagnosticsMock;
use crate::entropy::EntropyMock;
use crate::error::ServerError;
use crate::publication::FixedPublication;

#[test]
fn generation_and_total_byte_bounds_charge_shared_bytes_without_eviction() {
    let bytes = File {
        bytes: vec![0; MAX_BYTES].into(),
        content_type: "image/png".into(),
    };
    let mut state = State::default();
    let full = BTreeMap::from([("image.png".into(), bytes)]);
    admit(&state, "one", &full).unwrap();
    state.bundles.insert(
        "one".into(),
        Bundle {
            files: full.clone(),
            accepted: None,
            touched: 0,
        },
    );
    assert!(matches!(
        admit(&state, "one", &files()),
        Err(ServerError::ComparisonCapacity)
    ));
    admit(&state, "two", &full).unwrap();
    state.bundles.insert(
        "two".into(),
        Bundle {
            files: full.clone(),
            accepted: None,
            touched: 0,
        },
    );
    assert!(matches!(
        admit(&state, "three", &files()),
        Err(ServerError::ComparisonCapacity)
    ));
    admit(&state, "one", &full).unwrap();
    assert_eq!(state.bundles.len(), 2);
    assert_eq!(
        state.bundles["one"].files["image.png"].bytes.len(),
        MAX_BYTES
    );
}

#[tokio::test]
async fn refresh_identity_collision_keeps_the_earlier_generation() {
    let accepted = accepted(Arc::new(Unimock::new(())), Arc::new(Unimock::new(())));
    let publications = Arc::new(FixedPublication::new(snapshot(Some(accepted.clone()))));
    let store: &dyn Comparisons = &MemoryComparisons::new(
        Arc::new(Unimock::new(
            ClockMock::milliseconds.each_call(matching!()).returns(0u64),
        )),
        Arc::new(Unimock::new(
            EntropyMock::secret
                .each_call(matching!())
                .returns("a".repeat(64))
                .n_times(2),
        )),
        Arc::new(Unimock::new(
            CapturerMock::capture
                .each_call(matching!(_, "sample", false, _))
                .answers(&|_, _, _, _, _| Ok(files()))
                .n_times(2),
        )),
        publications,
        Arc::new(Unimock::new(
            DiagnosticsMock::failed
                .next_call(matching!(_))
                .answers(&|_, error| assert!(matches!(error, ServerError::ComparisonCapacity))),
        )),
    );
    let id = store
        .selected(accepted.clone(), "sample".into(), false)
        .await
        .unwrap();
    assert!(matches!(
        *store
            .selected(accepted, "sample".into(), true)
            .await
            .unwrap_err(),
        ServerError::ComparisonCapacity
    ));
    assert_eq!(
        store
            .file(&id, "entries/sample.json")
            .await
            .unwrap()
            .unwrap()
            .bytes,
        "{}"
    );
    store.stop().await;
}
