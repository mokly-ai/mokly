//! Empty description boundary for integration fixtures without JavaScript definitions.

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::definition_provider::{DefinitionProvider, Definitions};
use mokly_catalogue::discovery::SourceFile;
use mokly_catalogue::error::Result;

/// Description fixture with no exported definitions.
pub struct EmptyDefinitions;

impl DefinitionProvider for EmptyDefinitions {
    fn describe(&self, _config: &ResolvedConfig, _files: &[SourceFile]) -> Result<Definitions> {
        Ok(Definitions::default())
    }
}
