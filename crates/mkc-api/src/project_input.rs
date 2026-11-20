//! Closed project creation alternatives with an optional installed repository link.

use mkc_domain::slug::ProjectSlug;
use serde::Deserialize;
use utoipa::ToSchema;
use uuid::Uuid;

/// Create one project with either an installed repository or a CLI identity.
#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(untagged)]
pub(crate) enum CreateProject {
    /// Link a repository from the installation's repository list.
    Installed(InstalledProject),
    /// Publish with the CLI, without a GitHub repository link or cloud builds.
    Repository(RepositoryProject),
}

/// Project inputs backed by an installed repository the App can read.
#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct InstalledProject {
    pub(crate) repository_id: Uuid,
    #[schema(min_length = 1, max_length = 80)]
    pub(crate) name: String,
    pub(crate) slug: ProjectSlug,
    /// Repository-relative config path ending in .json.
    /// Required by the API; the app supplies mokly.config.json as its default.
    pub(crate) config_path: String,
}

/// Project inputs backed by the Mokly CLI's portable repository identity.
#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RepositoryProject {
    /// CLI identity: owner/name on GitHub, or host/owner/name on another Git host.
    #[schema(min_length = 3, max_length = 769)]
    pub(crate) repository: String,
    #[schema(min_length = 1, max_length = 80)]
    pub(crate) name: String,
    pub(crate) slug: ProjectSlug,
    /// Repository-relative config path ending in .json.
    /// Required by the API; the app supplies mokly.config.json as its default.
    pub(crate) config_path: String,
}

impl CreateProject {
    pub(crate) fn name(&self) -> &str {
        match self {
            Self::Installed(input) => &input.name,
            Self::Repository(input) => &input.name,
        }
    }

    pub(crate) fn slug(&self) -> &ProjectSlug {
        match self {
            Self::Installed(input) => &input.slug,
            Self::Repository(input) => &input.slug,
        }
    }

    pub(crate) fn config_path(&self) -> &str {
        match self {
            Self::Installed(input) => &input.config_path,
            Self::Repository(input) => &input.config_path,
        }
    }
}
