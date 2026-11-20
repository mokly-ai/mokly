//! Warm plans cross into the core only after the sidecar accepts their compilation.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::bundle_outcomes::CacheOutcome;
use crate::bundle_store::{BundleStoreMock, ReadOutcome, RecordToken, WriteOutcome};
use crate::resolution_plan::{PlannedImport, ResolutionPlan};

use super::{bundle, pool, recipe, worker};

#[test]
fn a_warm_plan_is_returned_only_for_the_runtime_key_the_sidecar_accepted() {
    let plan = Arc::new(ResolutionPlan {
        imports: BTreeMap::from([(
            "edge".into(),
            PlannedImport {
                path: "/repo/target.ts".into(),
                side_effects: true,
            },
        )]),
    });
    for (accepted, expected) in [("seed", Some(plan.clone())), ("fresh", None)] {
        let stored = recipe("seed").with_plan(Some(plan.clone()));
        let store = Unimock::new((
            BundleStoreMock::load
                .some_call(matching!(_))
                .returns(ReadOutcome::Hit {
                    recipe: Box::new(stored),
                    token: RecordToken::new([7; 32]),
                    maintenance: WriteOutcome::Unchanged,
                }),
            BundleStoreMock::save
                .some_call(matching!(_))
                .returns(WriteOutcome::Written),
        ));
        let events = Arc::new(Mutex::new(vec![]));
        let pool = pool(
            store,
            worker(events.clone(), accepted, u64::from(accepted != "seed")),
        );
        let result = bundle(&pool);
        assert_eq!(result.plan, expected, "accepted runtime {accepted}");
        assert_eq!(
            result.cache,
            Some(if accepted == "seed" {
                CacheOutcome::Hit
            } else {
                CacheOutcome::StampMismatch
            })
        );
        assert_eq!(
            *events.lock().unwrap(),
            ["restore:disk:seed", "bundle", "dispose:disk:seed"]
        );
    }
}
