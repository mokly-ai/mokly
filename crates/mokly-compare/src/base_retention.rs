//! Optional provider-owned retention of one captured historical generation.

use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_git::control::Cancellation;
use mokly_graph::types::RenderGeneration;

use crate::base_selection::PinnedBase;
use crate::source_failures::SourceFailures;

/// Inputs for the provider's kept-base key and freshness checks.
pub struct BaseRetentionRequest<'a> {
    /// Pinned repository and merge-base identity, selected before any base read.
    pub selected: &'a PinnedBase,
    /// Adopted working configuration, including its resolved paths.
    pub working_config: &'a ResolvedConfig,
    /// Current head whose dependency inputs participate in freshness checks.
    pub head: &'a dyn RenderGeneration,
    /// Effective lifecycle-script setting after configuration and CLI selection.
    pub install_scripts: bool,
}

/// Captured historical inputs and their diagnostic state, retained as one identity.
pub struct KeptBase {
    /// Captured generation, including its original graph, sources, and leases.
    pub generation: Arc<dyn RenderGeneration>,
    /// Shared source failures and conversion warnings of this exact generation.
    pub failures: Arc<dyn SourceFailures>,
    /// Whether a tier-two install supplied dependencies with scripts off.
    pub scripts_off: bool,
}

/// One classification's access to a kept base, with independent cancellation.
pub struct BaseReuse {
    /// Exact kept identity. Release must compare identities before clearing a slot.
    pub base: Arc<KeptBase>,
    /// Checked before each fallible read. It does not cancel the shared base.
    pub cancellation: Arc<dyn Cancellation>,
}
