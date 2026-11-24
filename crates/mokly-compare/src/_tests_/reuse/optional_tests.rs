//! Optional facts preserve the exact comparison admission outcome at a tight bound.

use crate::comparison_reuse::{ComparisonReuse, MemoryComparisons, ReuseFence};

use super::support::{Fixture, engine, request, review};

#[test]
fn optional_facts_never_remove_a_comparison_that_fits_without_them() {
    let fixture = Fixture::default();
    let measured = MemoryComparisons::new(1024 * 1024);
    let baseline = measured.begin(engine(), ReuseFence::new(&"settings"));
    baseline
        .compare_prepared(
            &request(),
            fixture.generation(false, true),
            fixture.generation(true, true),
        )
        .unwrap();
    let bound = baseline.work().peak_bytes;
    let mut outputs = Vec::new();
    for facts in [false, true] {
        let store = MemoryComparisons::new(bound);
        let _optional = facts.then(|| store.shared.resident.register_optional(bound / 2).unwrap());
        let attempt = store.begin(engine(), ReuseFence::new(&"settings"));
        let result = attempt
            .compare_prepared(
                &request(),
                fixture.generation(false, true),
                fixture.generation(true, true),
            )
            .unwrap();
        assert_eq!(attempt.work().candidate_views, 2);
        assert!(!attempt.work().overflowed);
        assert!(attempt.work().peak_bytes <= bound);
        outputs.push(review(&result));
        attempt.accept();
    }
    assert_eq!(outputs[0], outputs[1]);
}
