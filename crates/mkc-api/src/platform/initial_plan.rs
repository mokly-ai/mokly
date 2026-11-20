//! Initial workspace plan for the configured preview identity only.

use mkc_domain::values::Plan;
use mkc_store_interface::user::User;

/// Validated identity and plan; carries no sign-in credential.
pub(crate) struct PreviewWorkspacePlan {
    /// Normalized account email from preview sign-in configuration.
    pub(crate) email: String,
    /// Initial workspace plan from the capability-gated configuration.
    pub(crate) plan: Plan,
}

impl PreviewWorkspacePlan {
    /// Compare with the creator read inside the workspace creation transaction.
    pub(super) fn for_creator(&self, creator: &User) -> Plan {
        if creator.email == self.email {
            self.plan
        } else {
            Plan::Free
        }
    }
}
