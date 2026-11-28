//! Run catalogue root expansion through the shared, source-routed sidecar.

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::{Code, Issue};
use mokly_catalogue::error::{CatalogueError, InternalError, Result};
use mokly_catalogue::storybook_roots::{
    self, StorybookEntry, StorybookInputs, StorybookReader, StorybookStories,
};
use mokly_sidecar::methods::Call;
use mokly_sidecar::postcss_evidence::Read;
use mokly_sidecar::storybook::{ReadStorybookParams, ReadStorybookReply};
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::read_evidence::{ReadBaseline, ReadEvidence};

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
        let result = match self.pool.request(Call::ReadStorybook(params)) {
            Ok(MethodResult::Storybook(ReadStorybookReply::Loaded(result))) => result,
            Ok(MethodResult::Storybook(ReadStorybookReply::Failed { main_error })) => {
                return Err(CatalogueError::Config(Issue::new(
                    Code::ConfigInvalid,
                    main_error,
                )));
            }
            Ok(_) => {
                return Err(InternalError::Provider {
                    source: Box::new(std::io::Error::other("expected a readStorybook result")),
                }
                .into());
            }
            Err(source) => {
                return Err(match source.diagnostic() {
                    Some(source) => CatalogueError::Runtime { source },
                    None => InternalError::Provider {
                        source: Box::new(source),
                    }
                    .into(),
                });
            }
        };
        for directory in &result.dependency_directories {
            self.dependency_usage.unmapped(directory);
        }
        let mut versions = ReadEvidence::default();
        for input in result.inputs {
            if let Read::WholeFile { path, digest, .. } = input {
                versions.insert(path, ReadBaseline::ObservedWholeFile(digest));
            }
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
            inputs: StorybookInputs {
                versions,
                absent: result.absent_inputs.into_iter().collect(),
            },
        })
    }
}
