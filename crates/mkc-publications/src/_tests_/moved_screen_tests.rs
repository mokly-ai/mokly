//! Admission stores a moved screen's current path and retains its previous identity.

use serde_json::json;

use crate::{check_summary, screen_observation, screens};

use super::index_fixture::{empty, parse, record};

#[test]
fn moved_screen_observations_use_current_paths_and_before_evidence_uses_previous_paths() {
    let mut document = empty();
    let mut screen = record("After/Kept_1", "Kept screen", "unmodified");
    screen["previousPath"] = json!("Before/Kept_1");
    document["screens"] = json!([screen]);
    let index = parse(&document);
    assert_eq!(
        screens::current(index.current_screens())[0].path.as_str(),
        "After/Kept_1"
    );
    assert!(
        screen_observation::views(index.current_screens())
            .iter()
            .all(|view| view.screen_path.as_str() == "After/Kept_1")
    );
    assert_eq!(
        check_summary::changes(&index).0.changed as usize,
        index.counted_records().len()
    );
    assert_eq!(
        index.counted_records()[0].previous_path.as_deref(),
        Some("Before/Kept_1")
    );
    assert_eq!(index.counted_records()[0].path, "After/Kept_1");
}
