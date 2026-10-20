//! Static provider admission keeps verification between preparation and rendering.

use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_compare::base_render::{BaseProvider, BaseProviderMock, BaseRequest, HistoricalSources};
use mokly_compare::error::Error;
use mokly_git::identity::ObjectId;
use mokly_graph::error::GraphError;
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
                .returns(Ok(generation.clone())),
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
            sources: HistoricalSources {
                tree: Arc::new(Unimock::new(())),
                sources: Arc::new(Unimock::new(())),
                failures: Arc::new(Unimock::new(())),
            },
        });
        if changed {
            assert!(matches!(result, Err(Error::Graph {
                source: GraphError::InputsChanged { path },
            }) if path.to_str() == Some("/selected/plugin.mjs")));
        } else {
            assert!(Arc::ptr_eq(&result.unwrap(), &generation));
        }
    }
}
