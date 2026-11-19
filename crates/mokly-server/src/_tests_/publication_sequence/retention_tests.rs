//! Candidates own independent bounded records and drop entries that leave the catalogue.

use std::sync::Arc;

use mokly_model::axes::ColorScheme;
use mokly_test_support::capture::Trace;

use crate::publication::{PublicationWriter, Publications, SharedPublication};
use crate::snapshot::SnapshotFactory;

use super::support::{generation, generation_in_scheme, input, projector};

#[test]
fn candidates_isolate_records_and_rebuild_slots_evict_and_prune_old_details() {
    let traces = Trace::default();
    traces.in_scope(|| {
        let builds = || traces.closed("detail.build").len();
        let projector = projector();
        let origin = projector.create(generation(4, 0), input(1)).unwrap();
        let shared = SharedPublication::new(origin.clone());
        let before = builds();
        let rejected = projector
            .replace(
                generation_in_scheme(4, 1, ColorScheme::Dark),
                input(3),
                &origin,
            )
            .unwrap();
        assert_eq!(builds() - before, 4);
        assert!(!shared.replace(rejected));
        assert!(Arc::ptr_eq(&shared.current(), &origin));
        let before = builds();
        let dark = projector
            .replace(
                generation_in_scheme(4, 2, ColorScheme::Dark),
                input(2),
                &origin,
            )
            .unwrap();
        assert_eq!(
            builds() - before,
            4,
            "a rejected candidate must not seed the live records"
        );
        assert!(shared.replace(dark.clone()));
        let before = builds();
        let light = projector
            .replace(generation(4, 3), input(3), &dark)
            .unwrap();
        assert_eq!(
            builds() - before,
            4,
            "the previous rebuild slot was evicted"
        );
        assert_eq!(
            light.details["screen-0"].detail_id,
            origin.details["screen-0"].detail_id
        );
        let removed = Arc::downgrade(&light.details["screen-3"]);
        let mut current = projector
            .replace(generation(3, 4), input(4), &light)
            .unwrap();
        assert_eq!(current.details.len(), 3);
        assert!(!current.details.contains_key("screen-3"));
        let retained: Vec<_> = light.details.values().map(Arc::downgrade).collect();
        drop(light);
        assert!(
            removed.upgrade().is_none(),
            "an absent path must not retain its typed detail"
        );
        let mut versions = Vec::new();
        for edit in 5..13 {
            versions.push(Arc::downgrade(&current.details["screen-0"]));
            let scheme = if edit % 2 == 0 {
                ColorScheme::Light
            } else {
                ColorScheme::Dark
            };
            current = projector
                .replace(
                    generation_in_scheme(3, edit, scheme),
                    input(current.index.revision + 1),
                    &current,
                )
                .unwrap();
        }
        assert!(retained.iter().all(|record| record.upgrade().is_none()));
        assert_eq!(
            versions
                .iter()
                .filter(|record| record.upgrade().is_some())
                .count(),
            0,
            "rebuild-only publications retain only their current kind slot"
        );
    });
}
