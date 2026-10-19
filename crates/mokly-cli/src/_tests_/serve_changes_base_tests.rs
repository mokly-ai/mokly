//! Historical preparation retains only dependency warnings and respects cancellation.

use std::sync::{Arc, Mutex};

use mokly_catalogue::diagnostic::WarningSubject;
use mokly_compare::base_render::{BaseProvider, BaseProviderMock, BaseRequest, HistoricalSources};
use mokly_compare::error::Error;
use mokly_git::identity::ObjectId;
use mokly_graph::error::GraphError;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_model::public_metadata::ChangesStatus;
use mokly_server::changes::ChangeProgressMock;
use unimock::{MockFn, Unimock, matching};

use crate::serve_changes_base::AttemptBase;
use crate::warning_support::{catalogue, config, warning};

#[test]
fn base_preparation_retains_dependency_warnings_and_never_composes_a_view() {
    for active in [true, false] {
        let mut dependency = warning("Uses current dependencies.");
        dependency.code = "base-dependencies";
        dependency.subject = WarningSubject::Configuration("mokly.config.json".into());
        let records = vec![dependency.clone(), warning("Historical author warning.")];
        let graph = Unimock::new(
            RenderGenerationMock::catalogue
                .next_call(matching!())
                .returns(catalogue(records)),
        );
        let graph: Arc<dyn RenderGeneration> = Arc::new(graph);
        let inner = Unimock::new(
            BaseProviderMock::prepare
                .next_call(matching!(_))
                .returns(Ok(graph)),
        );
        let progress = Unimock::new(
            ChangeProgressMock::status
                .next_call(matching!(ChangesStatus::Pending))
                .returns(Ok(active)),
        );
        let warnings = Arc::new(Mutex::new(Vec::new()));
        let provider: &dyn BaseProvider = &AttemptBase {
            warnings: warnings.clone(),
            inner: Arc::new(inner),
            progress: Arc::new(progress),
        };
        let config = config();
        let result = provider.prepare(&BaseRequest {
            working_config: &config,
            repository: Arc::new(Unimock::new(())),
            commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
            sources: HistoricalSources {
                failures: Arc::new(Unimock::new(())),
                tree: Arc::new(Unimock::new(())),
                sources: Arc::new(Unimock::new(())),
            },
        });
        assert_eq!(*warnings.lock().unwrap(), [dependency]);
        if active {
            assert!(result.is_ok());
        } else {
            assert!(matches!(result, Err(Error::Cancelled)));
        }
    }
}

#[test]
fn failed_graph_preparation_retains_only_its_dependency_warning() {
    let mut dependency = warning("Uses current dependencies.");
    dependency.code = "base-dependencies";
    dependency.subject = WarningSubject::Configuration("mokly.config.json".into());
    let inner = Unimock::new(
        BaseProviderMock::prepare
            .next_call(matching!(_))
            .returns(Err(Error::Graph {
                source: GraphError::Attempt {
                    failures: vec![],
                    warnings: vec![dependency.clone(), warning("Historical composition.")],
                },
            })),
    );
    let warnings = Arc::new(Mutex::new(Vec::new()));
    let provider: &dyn BaseProvider = &AttemptBase {
        warnings: warnings.clone(),
        inner: Arc::new(inner),
        progress: Arc::new(Unimock::new(())),
    };
    let config = config();
    let result = provider.prepare(&BaseRequest {
        working_config: &config,
        repository: Arc::new(Unimock::new(())),
        commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
        sources: HistoricalSources {
            failures: Arc::new(Unimock::new(())),
            tree: Arc::new(Unimock::new(())),
            sources: Arc::new(Unimock::new(())),
        },
    });
    assert!(matches!(result, Err(Error::Graph { .. })));
    assert_eq!(*warnings.lock().unwrap(), [dependency]);
}
