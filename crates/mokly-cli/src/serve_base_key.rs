//! The kept base key includes every adopted configuration path and script setting.

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::base_selection::PinnedBase;
use mokly_compare::error::{InternalError, Result};
use mokly_git::identity::ObjectId;
use mokly_model::material::digest;

/// Adopted preparation inputs that must stay equal before reuse.
#[derive(Clone, Eq, PartialEq)]
pub struct BaseKey {
    commit: ObjectId,
    configuration: String,
    install_scripts: bool,
}

impl BaseKey {
    /// Hash the configuration and retain the selected commit and effective scripts flag.
    pub(super) fn new(request: &BaseRetentionRequest<'_>) -> Result<Self> {
        Self::selected(
            request.selected,
            request.working_config,
            request.install_scripts,
        )
    }

    pub(super) fn selected(
        selected: &PinnedBase,
        config: &ResolvedConfig,
        install_scripts: bool,
    ) -> Result<Self> {
        let roots = config
            .roots
            .iter()
            .map(|root| (&root.input, &root.directory, &root.identity))
            .collect::<Vec<_>>();
        let bytes = match serde_json::to_vec(&(
            &config.input,
            &config.modules,
            &config.file,
            &config.repo_root,
            roots,
            &config.authored_inputs,
        )) {
            Ok(bytes) => bytes,
            Err(source) => return Err(InternalError::Json { source }.into()),
        };
        Ok(Self {
            commit: selected.commit.clone(),
            configuration: digest(&bytes),
            install_scripts,
        })
    }
}
