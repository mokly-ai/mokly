//! The native validation boundary must stop before step 1 admits document prefetch.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_cli::cancellation::ServeCancellation;
use mokly_compare::base_render::{BaseRequest, HistoricalSources};
use mokly_git::identity::ObjectId;
use mokly_graph::types::RenderGenerationMock;
use mokly_graph::workers::RenderWorkersMock;
use mokly_render::runtime::Runtime;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::base_render_admission::BaseRenderAdmissionMock;
use crate::changes_base::NativeBase;
use crate::changes_base_sources::NativePhases;
use crate::warning_support::{catalogue, config};

#[test]
fn eager_validation_stops_before_the_real_prefetch_admission_boundary() {
    let checks = Arc::new(AtomicUsize::new(0));
    let observed = checks.clone();
    let tree = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, _| Ok(None)),
        SourceTreeMock::prefetch
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
    ));
    let provider: &dyn NativePhases = &NativeBase {
        validation: None,
        admission: Arc::new(Unimock::new(
            BaseRenderAdmissionMock::check
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    observed.fetch_add(1, Ordering::SeqCst);
                    Ok(())
                })),
        )),
        runtime: Arc::new(Runtime::new(
            Arc::new(Unimock::new(())),
            Arc::new(tree.clone()),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(
                RenderWorkersMock::stylesheets
                    .some_call(matching!(_))
                    .returns(Ok(Vec::new())),
            )),
            "test".into(),
            None,
        )),
        cancellation: Arc::new(ServeCancellation::default()),
        dependencies: Arc::new(Unimock::new(())),
        freshness: None,
    };
    let prepared = provider
        .validate(&BaseRequest {
            working_config: &config(),
            head: &Unimock::new(
                RenderGenerationMock::catalogue
                    .some_call(matching!())
                    .returns(catalogue(Vec::new())),
            ),
            repository: Arc::new(Unimock::new(())),
            commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
            install_scripts: false,
            sources: HistoricalSources {
                tree: Arc::new(tree.clone()),
                sources: Arc::new(Unimock::new(())),
                failures: Arc::new(Unimock::new(())),
            },
            steps: Arc::new(Unimock::new(
                mokly_compare::comparison_steps::StepsMock::step
                    .some_call(matching!(_))
                    .returns(()),
            )),
        })
        .unwrap();
    assert_eq!(
        checks.load(Ordering::SeqCst),
        0,
        "validation must not admit prefetch or a render callback"
    );
    let admitted = provider.admit(prepared).unwrap();
    assert_eq!(
        checks.load(Ordering::SeqCst),
        1,
        "adoption must retain the ordinary prefetch admission check"
    );
    assert!(!admitted.scripts_off);
}
