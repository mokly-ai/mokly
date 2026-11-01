//! Static provider admission keeps verification between preparation and rendering.

use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_compare::base_render::{
    BaseProvider, BaseProviderMock, BaseRequest, HistoricalSources, PreparedBase,
};
use mokly_compare::error::Error;
use mokly_git::identity::ObjectId;
use mokly_graph::error::{GraphError, InternalError};
use mokly_graph::types::RenderGeneration;
use mokly_static::error;
use mokly_static::fingerprint::InputTreeMock;
use unimock::{MockFn, Unimock, matching};

use crate::changes_static::StaticBase;

#[test]
fn static_base_admits_only_a_verified_prepared_generation() {
    for changed in [false, true] {
        let generation: Arc<dyn RenderGeneration> = Arc::new(Unimock::new(()));
        let boundaries = Unimock::new((
            BaseProviderMock::prepare
                .next_call(matching!(_))
                .returns(Ok(PreparedBase {
                    generation: generation.clone(),
                    scripts_off: true,
                })),
            InputTreeMock::verify
                .next_call(matching!())
                .returns(if changed {
                    Err(error::Error::InputsChanged {
                        path: "/selected/plugin.mjs".into(),
                    })
                } else {
                    Ok(())
                }),
        ));
        let provider: &dyn BaseProvider = &StaticBase {
            inner: Arc::new(boundaries.clone()),
            inputs: Arc::new(boundaries),
        };
        let config = ResolvedConfig {
            input: Config::default(),
            file: "/repo/mokly.config.json".into(),
            repo_root: "/repo".into(),
            roots: Vec::new(),
            authored_inputs: Vec::new(),
        };
        let result = provider.prepare(&BaseRequest {
            head: &Unimock::new(()),
            working_config: &config,
            repository: Arc::new(Unimock::new(())),
            commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
            install_scripts: false,
            sources: HistoricalSources {
                tree: Arc::new(Unimock::new(())),
                sources: Arc::new(Unimock::new(())),
                failures: Arc::new(Unimock::new(())),
            },
            steps: Arc::new(Unimock::new(())),
        });
        if changed {
            assert!(matches!(
                result,
                Err(error)
                    if error.scripts_off
                        && matches!(&*error.source, Error::Graph {
                            source: GraphError::InputsChanged { path },
                        } if path.to_str() == Some("/selected/plugin.mjs"))
            ));
        } else {
            let prepared = result.unwrap();
            assert!(Arc::ptr_eq(&prepared.generation, &generation));
            assert!(prepared.scripts_off);
        }
    }
}

#[test]
fn static_base_keeps_scripts_off_after_another_input_verification_failure() {
    let boundaries = Unimock::new((
        BaseProviderMock::prepare
            .next_call(matching!(_))
            .returns(Ok(PreparedBase {
                generation: Arc::new(Unimock::new(())),
                scripts_off: true,
            })),
        InputTreeMock::verify
            .next_call(matching!())
            .returns(Err(error::Error::Cancelled)),
    ));
    let provider: &dyn BaseProvider = &StaticBase {
        inner: Arc::new(boundaries.clone()),
        inputs: Arc::new(boundaries),
    };
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        roots: Vec::new(),
        authored_inputs: Vec::new(),
    };
    let result = provider.prepare(&BaseRequest {
        head: &Unimock::new(()),
        working_config: &config,
        repository: Arc::new(Unimock::new(())),
        commit: ObjectId::parse(&"a".repeat(40)).unwrap(),
        install_scripts: false,
        sources: HistoricalSources {
            tree: Arc::new(Unimock::new(())),
            sources: Arc::new(Unimock::new(())),
            failures: Arc::new(Unimock::new(())),
        },
        steps: Arc::new(Unimock::new(())),
    });
    assert!(matches!(result, Err(error)
        if error.scripts_off && matches!(error.source.as_ref(), Error::Graph {
            source: GraphError::Internal(InternalError::Provider { source }),
        } if matches!(source.downcast_ref::<error::Error>(), Some(error::Error::Cancelled)))
    ));
}
