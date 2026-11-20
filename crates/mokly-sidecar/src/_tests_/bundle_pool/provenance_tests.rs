//! Actual compilation distinguishes reuse even when runtime keys are unknown.

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::bundle_outcomes::CacheOutcome;
use crate::methods::Call;
use crate::wire::MethodResult;
use crate::workers::WorkerMock;

use super::{answer, bundle, pool, unchanged_hit};

#[test]
fn compile_events_override_runtime_key_inference() {
    for (runtime, compile_count, expected) in [
        ("unknown", 0, CacheOutcome::Memory),
        ("seed", 1, CacheOutcome::StampMismatch),
    ] {
        let worker = Unimock::new((
            WorkerMock::request
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, request, _| {
                    Ok(match request.call {
                        Call::Bundle(_) => answer(runtime, compile_count),
                        _ => MethodResult::Empty,
                    })
                })),
            WorkerMock::resident_bytes
                .some_call(matching!())
                .returns(Ok(0)),
        ));
        let pool = pool(unchanged_hit(), worker);
        let result = bundle(&pool);
        assert_eq!(
            result.cache,
            Some(expected),
            "runtime={runtime}, compile_count={compile_count}"
        );
        assert_eq!(
            pool.lock().slots[0].as_ref().unwrap().last_compilation,
            (compile_count != 0).then_some(result.epoch)
        );
    }
}
