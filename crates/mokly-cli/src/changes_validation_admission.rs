//! Graph validation needs proof for early working inputs or normal post-usage admission.

use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_compare::base_freshness::DependencySelection;
use mokly_compare::error::Result;
use mokly_git::source_key::CheckoutIdentity;
use mokly_render::side::BaseSide;

pub(super) struct ValidationRequest<'a> {
    pub(super) config: &'a ResolvedConfig,
    pub(super) checkout: Option<&'a CheckoutIdentity>,
    pub(super) selection: Option<&'a DependencySelection>,
    pub(super) base: Option<&'a Arc<BaseSide>>,
}

pub(super) trait GraphPreparationAdmission: Send + Sync {
    fn enter(&self, request: &ValidationRequest<'_>) -> Result<()>;
}
