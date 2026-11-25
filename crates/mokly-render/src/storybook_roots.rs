//! Run catalogue root expansion through the shared, source-routed sidecar.

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::{Code, Issue};
use mokly_catalogue::error::{CatalogueError, Result};
use mokly_catalogue::storybook_roots::{self, StorybookEntry, StorybookReader, StorybookStories};
use mokly_sidecar::error::Error;
use mokly_sidecar::methods::Call;
use mokly_sidecar::storybook::ReadStorybookParams;
use mokly_sidecar::wire::MethodResult;

use crate::runtime::Runtime;
use crate::side;

impl Runtime {
    /// Resolve Storybook roots with this runtime's source tree and dependencies.
    pub fn expand_storybook_roots(&self, config: &mut ResolvedConfig) -> Result<()> {
        storybook_roots::expand(config, self.tree.as_ref(), self)
    }
}

impl StorybookReader for Runtime {
    fn read(&self, config: &ResolvedConfig, folder: &str) -> Result<StorybookStories> {
        let side = side::inputs(config, self.base.as_ref(), 0);
        let params = ReadStorybookParams {
            source_root: side.source_root.to_string_lossy().into_owned(),
            configuration_directory: side.configuration_directory,
            repository_roots: side
                .repository_roots
                .iter()
                .map(|path| path.to_string_lossy().into_owned())
                .collect(),
            module_resolution: side.module_resolution,
            folder: folder.into(),
        };
        let main = if folder.is_empty() {
            "main.*".into()
        } else {
            format!("{folder}/main.*")
        };
        let result = match self.pool.request(Call::ReadStorybook(params)) {
            Ok(MethodResult::Storybook(result)) => result,
            Ok(_) => {
                return Err(invalid(format!("{main}: unexpected sidecar result")));
            }
            Err(Error::Remote { message, .. }) => return Err(invalid(message)),
            Err(source) => return Err(invalid(format!("{main}: {source}"))),
        };
        for directory in &result.dependency_directories {
            self.dependency_usage.unmapped(directory);
        }
        Ok(StorybookStories {
            main: result.main,
            entries: result
                .entries
                .into_iter()
                .map(|entry| StorybookEntry {
                    directory: entry.directory,
                    files: entry.files,
                })
                .collect(),
            inputs: result.inputs,
        })
    }
}

fn invalid(message: String) -> CatalogueError {
    CatalogueError::Config(Issue::new(Code::ConfigInvalid, message))
}
