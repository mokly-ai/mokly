//! Optional evidence cannot add a preparation failure or work for a static provider.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_cli::cancellation::BuildCancellation;
use mokly_compare::base_freshness::{Freshness, FreshnessMock};
use mokly_compare::base_render::{
    BasePreparationResult, BaseProvider, BaseRequest, HistoricalSources,
};
use mokly_compare::comparison_steps::{Step, StepsMock};
use mokly_compare::error::Error;
use mokly_git::error;
use mokly_git::identity::ObjectId;
use mokly_git::repository::RepositoryMock;
use mokly_git::source_key::CheckoutIdentity;
use mokly_graph::types::RenderGenerationMock;
use mokly_graph::workers::RenderWorkersMock;
use mokly_model::catalogue::CatalogueModel;
use mokly_render::runtime::Runtime;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::base_render_admission::ImmediateBaseRenders;
use crate::changes_base::NativeBase;

#[derive(Clone, Copy, Debug)]
enum Evidence {
    Disabled,
    SampleFailed,
    RecordFailed,
    SampleCancelled,
    RecordCancelled,
}

#[derive(Default)]
struct Calls {
    sample: AtomicUsize,
    record: AtomicUsize,
}

fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: Vec::new(),
        modules: Default::default(),
        authored_inputs: Vec::new(),
    }
}

fn catalogue() -> PreparedCatalogue {
    PreparedCatalogue {
        model: CatalogueModel {
            entries: Vec::new(),
            folders: Vec::new(),
            sources: Vec::new(),
            color_schemes: Vec::new(),
        },
        inventory: Default::default(),
        templates: Default::default(),
        documents: Default::default(),
        slot_fragments: Default::default(),
        elements: Default::default(),
        prop_validators: Default::default(),
        javascript: Default::default(),
        dependency_directories: Default::default(),
        warnings: Vec::new(),
    }
}

fn prepare(evidence: Evidence) -> (BasePreparationResult, Arc<Calls>) {
    let calls = Arc::new(Calls::default());
    let repository = if matches!(evidence, Evidence::Disabled) {
        Unimock::new(())
    } else {
        Unimock::new(
            RepositoryMock::checkout_identity
                .each_call(matching!(_))
                .answers_arc({
                    let calls = calls.clone();
                    Arc::new(move |_, _| {
                        calls.sample.fetch_add(1, Ordering::Relaxed);
                        match evidence {
                            Evidence::SampleFailed => Err(error::Error::FileCount { limit: 1 }),
                            Evidence::SampleCancelled => Err(error::Error::Cancelled),
                            _ => Ok(CheckoutIdentity {
                                digest: "checkout".into(),
                                filtered: false,
                            }),
                        }
                    })
                }),
        )
    };
    let freshness: Option<Arc<dyn Freshness>> = match evidence {
        Evidence::Disabled => None,
        Evidence::SampleFailed | Evidence::SampleCancelled => Some(Arc::new(Unimock::new(()))),
        Evidence::RecordFailed | Evidence::RecordCancelled => Some(Arc::new(Unimock::new(
            FreshnessMock::record.each_call(matching!(_)).answers_arc({
                let calls = calls.clone();
                Arc::new(move |_, _, _, _, _| {
                    calls.record.fetch_add(1, Ordering::Relaxed);
                    match evidence {
                        Evidence::RecordFailed => Err(Error::UnsafeCache {
                            path: "/cache".into(),
                        }),
                        Evidence::RecordCancelled => Err(Error::Cancelled),
                        _ => Ok(None),
                    }
                })
            }),
        ))),
    };
    let reads_base = !matches!(evidence, Evidence::SampleCancelled);
    let dependency_tree = if reads_base {
        Unimock::new(
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers(&|_, _| Ok(None)),
        )
    } else {
        Unimock::new(())
    };
    let workers = if reads_base {
        Unimock::new(
            RenderWorkersMock::stylesheets
                .some_call(matching!(_))
                .answers(&|_, _, _| Ok(Vec::new())),
        )
    } else {
        Unimock::new(())
    };
    let head = if reads_base {
        Unimock::new(
            RenderGenerationMock::catalogue
                .some_call(matching!())
                .returns(catalogue()),
        )
    } else {
        Unimock::new(())
    };
    let tree = if reads_base {
        Unimock::new((
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers(&|_, _| Ok(None)),
            SourceTreeMock::prefetch
                .some_call(matching!(_))
                .returns(Ok(())),
        ))
    } else {
        Unimock::new(())
    };
    let steps = if reads_base {
        Unimock::new(
            StepsMock::step
                .some_call(matching!(Step::Rendering))
                .returns(()),
        )
    } else {
        Unimock::new(())
    };
    let provider: &dyn BaseProvider = &NativeBase {
        validation: None,
        admission: Arc::new(ImmediateBaseRenders),
        runtime: Arc::new(Runtime::new(
            Arc::new(Unimock::new(())),
            Arc::new(dependency_tree),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(())),
            Arc::new(workers),
            "test".into(),
            None,
        )),
        cancellation: Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        dependencies: Arc::new(Unimock::new(())),
        freshness,
    };
    let result = provider.prepare(&BaseRequest {
        head: &head,
        working_config: &config(),
        repository: Arc::new(repository),
        commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
        install_scripts: false,
        sources: HistoricalSources {
            tree: Arc::new(tree),
            sources: Arc::new(Unimock::new(())),
            failures: Arc::new(Unimock::new(())),
        },
        steps: Arc::new(steps),
    });
    (result, calls)
}

#[test]
fn non_retaining_preparation_skips_optional_evidence() {
    let (result, calls) = prepare(Evidence::Disabled);
    let prepared = result.unwrap();
    assert_eq!(calls.sample.load(Ordering::Relaxed), 0);
    assert_eq!(calls.record.load(Ordering::Relaxed), 0);
    assert_eq!(
        prepared.freshness.map(|inputs| inputs.checkout.digest),
        None
    );
    assert!(!prepared.scripts_off);
}

#[test]
fn unavailable_sample_or_record_preserves_normal_preparation() {
    for (evidence, records) in [(Evidence::SampleFailed, 0), (Evidence::RecordFailed, 1)] {
        let (result, calls) = prepare(evidence);
        assert!(
            matches!(&result, Ok(prepared) if prepared.freshness.is_none()),
            "{evidence:?}: {:?}",
            result.as_ref().err()
        );
        assert_eq!(calls.sample.load(Ordering::Relaxed), 1, "{evidence:?}");
        assert_eq!(
            calls.record.load(Ordering::Relaxed),
            records,
            "{evidence:?}"
        );
    }
}

#[test]
fn cancelled_sample_or_record_preserves_typed_cancellation() {
    for (evidence, records) in [
        (Evidence::SampleCancelled, 0),
        (Evidence::RecordCancelled, 1),
    ] {
        let (result, calls) = prepare(evidence);
        assert!(
            matches!(result, Err(error) if !error.scripts_off && matches!(*error.source, Error::Cancelled)),
            "{evidence:?}"
        );
        assert_eq!(calls.sample.load(Ordering::Relaxed), 1, "{evidence:?}");
        assert_eq!(
            calls.record.load(Ordering::Relaxed),
            records,
            "{evidence:?}"
        );
    }
}
