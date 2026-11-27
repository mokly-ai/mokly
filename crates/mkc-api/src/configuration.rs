//! One gate and public answer for optional runtime configuration.

use serde::Serialize;
use utoipa::ToSchema;

use crate::billing::service::BillingService;
use crate::dispatch::ApiDispatcher;
use crate::error::{ApiError, Result};
use crate::github::service::GitHubIntegration;
use crate::operation::OptionalConfiguration;

/// The public configuration of optional API operations.
#[derive(Debug, Default, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = Configuration)]
pub(crate) struct ConfigurationView {
    github: bool,
    billing: bool,
    #[schema(required, inline)]
    preview_password: Option<PreviewPassword>,
}

/// The public identity of the shared account that accepts a preview password.
#[derive(Debug, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
struct PreviewPassword {
    #[schema(format = Email)]
    account: String,
}

/// The handler family selected by the optional-operation gate.
pub(crate) enum DispatchTarget<'a> {
    /// An operation that uses ordinary endpoint dispatch.
    Standard,
    /// An operation handled by the configured GitHub integration.
    GitHub(&'a dyn GitHubIntegration),
    /// An operation handled by the configured billing service.
    Billing(&'a dyn BillingService),
}

impl ApiDispatcher {
    /// Refuse absent configuration before the handler validates the request.
    pub(crate) fn dispatch_target(
        &self,
        configuration: Option<OptionalConfiguration>,
    ) -> Result<DispatchTarget<'_>> {
        let target = match configuration {
            None => Some(DispatchTarget::Standard),
            Some(OptionalConfiguration::PreviewSignIn) => self
                .auth
                .preview_sign_in_available()
                .then_some(DispatchTarget::Standard),
            Some(OptionalConfiguration::GitHub) => {
                self.github.as_deref().map(DispatchTarget::GitHub)
            }
            Some(OptionalConfiguration::Billing) => {
                self.billing.as_deref().map(DispatchTarget::Billing)
            }
        };
        target.ok_or(ApiError::OperationUnavailable)
    }

    /// Report each optional configuration that the operation gate accepts.
    pub(crate) fn configuration(&self) -> ConfigurationView {
        let mut view = ConfigurationView::default();
        for &kind in OptionalConfiguration::ALL {
            let configured = self.dispatch_target(Some(kind)).is_ok();
            match kind {
                OptionalConfiguration::GitHub => view.github = configured,
                OptionalConfiguration::Billing => view.billing = configured,
                OptionalConfiguration::PreviewSignIn => {
                    if configured {
                        view.preview_password =
                            self.auth
                                .preview_password_account()
                                .map(|account| PreviewPassword {
                                    account: account.to_owned(),
                                });
                    }
                }
            }
        }
        view
    }
}
