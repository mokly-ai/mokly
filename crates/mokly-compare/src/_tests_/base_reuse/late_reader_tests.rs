//! A reader can fail after publication without releasing a newer kept identity.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_graph::error::{GraphError, InternalError};
use mokly_graph::types::RenderGenerationMock;
use unimock::{MockFn, Unimock, matching};

use crate::base_retention::KeptBase;

use super::harness::Harness;
use super::support::{kept, provider_error};

#[test]
fn late_base_reader_failure_releases_its_identity_and_preserves_a_newer_base() {
    for replace in [false, true] {
        let fail = Arc::new(AtomicBool::new(false));
        let generation = Arc::new(Unimock::new((
            RenderGenerationMock::check_cancelled
                .each_call(matching!())
                .answers(&|_| Ok(())),
            RenderGenerationMock::resource_digest
                .each_call(matching!(_))
                .answers_arc({
                    let fail = fail.clone();
                    Arc::new(move |_, _| {
                        if fail.load(Ordering::Acquire) {
                            Err(provider_error())
                        } else {
                            Ok(Some("digest".into()))
                        }
                    })
                }),
        )));
        let harness = Harness::new(
            Some(kept(generation, Arc::new(Mutex::new(None)))),
            None,
            true,
        );
        let result = harness.classify().unwrap();
        let newer = replace.then(|| {
            Arc::new(KeptBase {
                generation: Arc::new(Unimock::new(())),
                failures: Arc::new(Unimock::new(())),
                scripts_off: true,
            })
        });
        if let Some(newer) = &newer {
            harness.state.lock().unwrap().slot = Some(newer.clone());
        }
        fail.store(true, Ordering::Release);
        for _ in 0..2 {
            let error = result
                .before
                .resource_digest("static/image.png")
                .unwrap_err();
            assert!(
                matches!(error, GraphError::Internal(InternalError::Provider { .. })),
                "replace={replace}"
            );
        }
        let state = harness.state.lock().unwrap();
        assert_eq!(
            (
                state.sources,
                state.prepares,
                state.captures,
                state.releases
            ),
            (0, 0, 0, 1),
            "replace={replace}"
        );
        assert_eq!(state.slot.is_some(), replace);
        assert_eq!(
            state
                .slot
                .as_ref()
                .zip(newer.as_ref())
                .map(|(actual, expected)| Arc::ptr_eq(actual, expected)),
            replace.then_some(true),
        );
    }
}
