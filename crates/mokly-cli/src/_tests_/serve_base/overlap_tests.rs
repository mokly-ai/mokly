//! Production checkpoints pause sidecar capture and recheck exact dependency sets.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_compare::base_render::{BaseProvider, PreparationCheckpoint};
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_server::usage_completion::UsageCompletionMock;
use unimock::{MockFn, Unimock, matching};

use crate::serve_base_preparation::Preparation;
use crate::serve_early_pool::PreparingPoolMock;
use crate::serve_preparation_control::PreparationControl;
use crate::warning_support::config;

use super::support::{Fixture, head, runtime, selected};

#[test]
fn only_sidecar_capture_waits_early_and_every_complete_outcome_waits() {
    for sidecar in [false, true] {
        let runtime = runtime();
        let mut fixture = Fixture::new(
            Arc::default(),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            runtime.clone(),
        );
        let waits = Arc::new(AtomicUsize::new(0));
        let called = waits.clone();
        let control: Arc<dyn PreparationControl> = Arc::new(Preparation::new(
            Arc::new(Unimock::new(
                UsageCompletionMock::wait
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, _| {
                        called.fetch_add(1, Ordering::SeqCst);
                        true
                    })),
            )),
            fixture.origin.clone(),
            Arc::new(Unimock::new(
                PreparingPoolMock::finish.each_call(matching!()).returns(()),
            )),
            runtime.dependency_usage.clone(),
        ));
        control.selected(sidecar, Vec::new(), Vec::new());
        Arc::get_mut(&mut fixture.provider).unwrap().preparation = Some(control);
        let selected = selected("a");
        let config = config();
        let head = head(!sidecar);
        let request = BaseRetentionRequest {
            selected: &selected,
            working_config: &config,
            head: head.as_ref(),
            install_scripts: false,
        };
        let capture = fixture
            .provider
            .checkpoint(&request, PreparationCheckpoint::Capture)
            .unwrap();
        let before_complete = waits.load(Ordering::SeqCst);
        let complete = fixture
            .provider
            .checkpoint(&request, PreparationCheckpoint::Complete)
            .unwrap();
        assert_eq!((capture, complete), (true, true));
        assert_eq!(before_complete, usize::from(sidecar));
        assert_eq!(waits.load(Ordering::SeqCst), usize::from(sidecar) + 1);
    }
}

#[derive(Clone, Copy, Debug)]
enum Growth {
    None,
    Directory,
    Unmapped,
}

#[test]
fn missing_retention_evidence_does_not_skip_either_final_dependency_set() {
    for growth in [Growth::None, Growth::Directory, Growth::Unmapped] {
        let runtime = runtime();
        runtime.dependency_usage.unmapped("node_modules");
        let mut fixture = Fixture::new(
            Arc::default(),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            runtime.clone(),
        );
        let dependencies = runtime.dependency_usage.clone();
        let control: Arc<dyn PreparationControl> = Arc::new(Preparation::new(
            Arc::new(Unimock::new(
                UsageCompletionMock::wait
                    .some_call(matching!(_))
                    .answers_arc(Arc::new(move |_, _| {
                        match growth {
                            Growth::None => {}
                            Growth::Directory => {
                                dependencies.unmapped("packages/extra/node_modules")
                            }
                            Growth::Unmapped => dependencies.unmapped("/outside/node_modules"),
                        }
                        true
                    })),
            )),
            fixture.origin.clone(),
            Arc::new(Unimock::new(
                PreparingPoolMock::finish.some_call(matching!()).returns(()),
            )),
            runtime.dependency_usage.clone(),
        ));
        control.selected(true, vec!["node_modules".into()], Vec::new());
        Arc::get_mut(&mut fixture.provider).unwrap().preparation = Some(control);
        let selected = selected("a");
        let config = config();
        let head = head(false);
        let request = BaseRetentionRequest {
            selected: &selected,
            working_config: &config,
            head: head.as_ref(),
            install_scripts: false,
        };
        let current = fixture
            .provider
            .checkpoint(&request, PreparationCheckpoint::Capture)
            .unwrap();
        assert_eq!(current, matches!(growth, Growth::None), "{growth:?}");
    }
}
