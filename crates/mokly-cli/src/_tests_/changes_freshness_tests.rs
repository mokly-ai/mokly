//! A mid-preparation checkout change cannot replace the sample of the bytes prepared.

use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_cli::cancellation::BuildCancellation;
use mokly_compare::base_freshness::{Freshness, FreshnessChecks, FreshnessRequest};
use mokly_compare::base_render::{BaseProvider, BaseRequest, HistoricalSources};
use mokly_compare::base_selection::PinnedBase;
use mokly_compare::comparison_steps::{Step, StepsMock};
use mokly_git::identity::ObjectId;
use mokly_git::repository::{Repository, RepositoryMock};
use mokly_git::source_key::CheckoutIdentity;
use mokly_graph::types::RenderGenerationMock;
use mokly_graph::workers::RenderWorkersMock;
use mokly_model::catalogue::CatalogueModel;
use mokly_render::runtime::Runtime;
use mokly_source_interface::tree::SourceTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::changes_base::NativeBase;

#[test]
fn checkout_change_after_first_base_read_preserves_the_sample_and_invalidates_reuse() {
    let setting = Arc::new(Mutex::new("before"));
    let repository: Arc<dyn Repository> = Arc::new(Unimock::new(
        RepositoryMock::checkout_identity
            .each_call(matching!(_))
            .answers_arc({
                let setting = setting.clone();
                Arc::new(move |_, _| {
                    Ok(CheckoutIdentity {
                        digest: setting.lock().unwrap().to_string(),
                        filtered: false,
                    })
                })
            })
            .n_times(2),
    ));
    let tree = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc({
                let setting = setting.clone();
                Arc::new(move |_, _| {
                    *setting.lock().unwrap() = "after";
                    Ok(None)
                })
            }),
        SourceTreeMock::prefetch
            .some_call(matching!(_))
            .returns(Ok(())),
    ));
    let checks: Arc<dyn Freshness> = Arc::new(FreshnessChecks {
        installs: Arc::new(Unimock::new(())),
        working: Arc::new(Unimock::new(())),
    });
    let provider: &dyn BaseProvider = &NativeBase {
        runtime: Arc::new(Runtime::new(
            Arc::new(Unimock::new(())),
            Arc::new(Unimock::new(
                SourceTreeMock::project
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok(None)),
            )),
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
        cancellation: Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        dependencies: Arc::new(Unimock::new(())),
        freshness: Some(checks.clone()),
    };
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: Vec::new(),
        authored_inputs: Vec::new(),
    };
    let commit = ObjectId::parse(&"a".repeat(40)).unwrap();
    let prepared = provider
        .prepare(&BaseRequest {
            head: &Unimock::new(
                RenderGenerationMock::catalogue
                    .some_call(matching!())
                    .returns(PreparedCatalogue {
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
                    }),
            ),
            working_config: &config,
            repository: repository.clone(),
            commit: commit.clone(),
            sources: HistoricalSources {
                tree: Arc::new(tree),
                sources: Arc::new(Unimock::new(())),
                failures: Arc::new(Unimock::new(())),
            },
            install_scripts: false,
            steps: Arc::new(Unimock::new(
                StepsMock::step
                    .some_call(matching!(Step::Rendering))
                    .returns(()),
            )),
        })
        .unwrap();
    let inputs = prepared.freshness.unwrap();
    assert_eq!(
        inputs.checkout,
        CheckoutIdentity {
            digest: "before".into(),
            filtered: false
        }
    );
    assert!(
        !checks
            .current(
                &inputs,
                &FreshnessRequest {
                    selected: &PinnedBase {
                        repository,
                        commit,
                        reference: "main".into()
                    },
                    head: &Unimock::new(()),
                    directories: &[],
                    unmapped: &[],
                }
            )
            .unwrap()
    );
}
