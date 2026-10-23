//! Provider source names stay relative before any source-tree access.

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::config_types::{Config, ResolvedConfig};
use crate::definition_provider::{DefinitionProviderMock, Definitions};
use crate::discovery::{DiscoveryMock, Inventory};
use crate::error::CatalogueError;
use crate::preparation::{Builder, CatalogueBuilder};

#[test]
fn rooted_provider_sources_fail_before_projection() {
    for source in [
        "/repo/private.txt",
        "//host/share/private.txt",
        "\\repo\\private.txt",
    ] {
        let boundaries = Arc::new(Unimock::new((
            DiscoveryMock::discover
                .next_call(matching!(_, _))
                .returns(Ok(Inventory::default())),
            DefinitionProviderMock::describe
                .next_call(matching!(_, _))
                .returns(Ok(Definitions {
                    sources: vec![source.into()],
                    ..Default::default()
                })),
        )));
        let config = ResolvedConfig {
            input: Config {
                renderer: Some("renderer.tsx".into()),
                ..Default::default()
            },
            file: "/repo/mokly.config.json".into(),
            repo_root: "/repo".into(),
            authored_inputs: Vec::new(),
            roots: Vec::new(),
        };
        let builder = Builder {
            tree: Arc::new(Unimock::new(())),
            discovery: boundaries.clone(),
            definitions: boundaries,
        };
        let CatalogueError::Invalid { issues, .. } = builder.prepare(&config, None).unwrap_err()
        else {
            panic!()
        };
        assert!(issues.iter().any(|issue| {
            issue.code.as_str() == "config-invalid"
                && issue.message == format!("invalid inventoried source {source}")
        }));
    }
}
