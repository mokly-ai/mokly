//! Definition and graph factories capture one immutable view of the source trees.

use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::definition_provider::{DefinitionProvider, Definitions};
use mokly_catalogue::discovery::SourceFile;
use mokly_catalogue::error::{CatalogueError, InternalError};
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::{GraphFactory, RenderGraph};

use crate::definitions;
use crate::graph::JavaScriptGraph;
use crate::runtime::Runtime;

impl DefinitionProvider for Runtime {
    fn describe(
        &self,
        config: &ResolvedConfig,
        files: &[SourceFile],
    ) -> mokly_catalogue::error::Result<Definitions> {
        let _describing = self
            .describing
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let mut attempt = self.clone();
        attempt.tree = Arc::new(SourceSnapshot::new(self.tree.clone()));
        attempt.dependency_tree = Arc::new(SourceSnapshot::new(self.dependency_tree.clone()));
        match definitions::describe(&attempt, config, files) {
            Ok(definitions) => Ok(definitions),
            Err(source) => match source.diagnostic() {
                Some(source) => Err(CatalogueError::Runtime { source }),
                None => Err(CatalogueError::Internal(InternalError::Provider {
                    source: Box::new(source),
                })),
            },
        }
    }
}

impl GraphFactory for Runtime {
    fn create(&self, _config: &ResolvedConfig) -> mokly_graph::error::Result<Arc<dyn RenderGraph>> {
        let mut runtime = self.clone();
        runtime.tree = Arc::new(SourceSnapshot::new(self.tree.clone()));
        runtime.dependency_tree = Arc::new(SourceSnapshot::new(self.dependency_tree.clone()));
        Ok(Arc::new(JavaScriptGraph { runtime }))
    }
}
