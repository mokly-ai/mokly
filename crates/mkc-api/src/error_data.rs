//! Public context carried by conflict and precondition responses.

use mkc_domain::ids::{BuildId, ProjectId, PublicationId};
use mkc_domain::values::Plan;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Current version of a resource after an optimistic concurrency failure.
#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VersionConflict {
    /// Version the client must read before submitting a new mutation.
    #[schema(minimum = 1)]
    pub current_version: i64,
}

/// Project already using the requested repository/config identity.
#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DuplicateProject {
    /// Project the caller can open instead of creating another.
    #[schema(value_type = Uuid)]
    pub existing_project_id: ProjectId,
}

/// The plan that includes a feature the workspace's current plan lacks.
#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanRequired {
    /// Plan the workspace must be on for the refused write.
    pub required_plan: Plan,
    /// Stable kebab-case name of the gated feature, for example "private-projects".
    pub feature: String,
}

/// Recovery context for a current, historical or reserved slug conflict.
#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SlugConflict {
    /// Input field carrying the rejected value.
    pub field: SlugField,
    /// First safe candidate observed while handling the rejection.
    pub suggested_slug: String,
}

/// Input field that a slug refusal names.
#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum SlugField {
    /// The `slug` input of a workspace or project write.
    Slug,
}

/// Pull request condition that prevents a cloud build.
#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum IneligibleCause {
    /// The pull request is closed.
    ClosedPullRequest,
    /// The source repository differs from the bound repository or is absent.
    ForkPullRequest,
}

/// Safe eligibility refusal context.
#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct BuildIneligible {
    /// Condition the caller can address through CI or another reference.
    pub cause: IneligibleCause,
}

/// Build already processing the requested head.
#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActiveBuild {
    /// Build the caller can open.
    #[schema(value_type = Uuid)]
    pub build_id: BuildId,
}

/// Ready publication for the requested head and configuration.
#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PublishedBuild {
    /// Publication the caller can open.
    #[schema(value_type = Uuid)]
    pub publication_id: PublicationId,
}
