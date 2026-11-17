//! Runtime platform service; external effects happen outside retriable queries.

use std::sync::Arc;

use mkc_email_interface::mail::Mailer;
use mkc_auth::runtime::Runtime;
use mkc_auth::service::Identity;
use mkc_billing::entitlements::Entitlements;
use mkc_billing::lifecycle::BillingLifecycle;
use mkc_domain::ids::UserId;
use mkc_store_interface::integration::IntegrationSubject;
use mkc_store_interface::store::Store;

use crate::action::Action;
use crate::builds::service::BuildsApi;
use crate::pagination::Pagination;
use crate::payload::{Effect, Payload, Reply};
use crate::views::account::SessionView;

use super::error::{Error, ErrorResultExt, Result};
use super::execution::{Command, Execution};
use super::initial_plan::PreviewWorkspacePlan;
use super::projection;

#[unimock::unimock(api = [ExecutePlatformMock, PlatformSessionMock])]
pub(crate) trait Platform: Send + Sync {
    fn execute(&self, actor: Option<UserId>, action: Action, page: Pagination) -> Result<Reply>;
    fn session(&self, identity: &Identity) -> Result<SessionView>;
}

pub(crate) struct PlatformService {
    pub(crate) builds: Arc<dyn BuildsApi>,
    pub(crate) store: Arc<dyn Store>,
    pub(crate) runtime: Arc<dyn Runtime>,
    pub(crate) mailer: Arc<dyn Mailer>,
    pub(crate) entitlements: Arc<dyn Entitlements>,
    pub(crate) billing: Arc<dyn BillingLifecycle>,
    pub(crate) app_origin: String,
    pub(crate) preview_workspace: Option<PreviewWorkspacePlan>,
}

impl Platform for PlatformService {
    fn execute(&self, actor: Option<UserId>, action: Action, page: Pagination) -> Result<Reply> {
        let mut canceled_subscription = None;
        if let Action::DeleteWorkspace(workspace, _) = &action {
            let preflight = Execution {
                builds_configured: self.builds.configured(),
                actor,
                action: &action,
                page,
                id: self.runtime.id(),
                second_id: self.runtime.id(),
                now: self.runtime.now(),
                entitlements: self.entitlements.as_ref(),
                preview_workspace: self.preview_workspace.as_ref(),
                token_secret: None,
                app_origin: &self.app_origin,
                canceled_subscription: None,
            };
            self.transact(true, &mut |queries| preflight.validate_deletion(queries))?;
            canceled_subscription = self
                .billing
                .cancel_for_deletion(*workspace)?
                .provider_subscription_id;
        }
        let execution = Execution {
            builds_configured: self.builds.configured(),
            actor,
            action: &action,
            page,
            id: self.runtime.id(),
            second_id: self.runtime.id(),
            now: self.runtime.now(),
            entitlements: self.entitlements.as_ref(),
            preview_workspace: self.preview_workspace.as_ref(),
            token_secret: if matches!(action, Action::CreateToken(..)) {
                Some(format!(
                    "mkc_{}",
                    self.runtime.secret().context("generate project token")?
                ))
            } else {
                None
            },
            app_origin: &self.app_origin,
            canceled_subscription,
        };
        let command: &dyn Command = &execution;
        let mut reply = None;
        self.transact(false, &mut |queries| {
            reply = Some(command.execute(queries)?);
            Ok(())
        })?;
        let mut reply = reply.ok_or(Error::NotFound)?;
        if let (Action::CreateProject(_, _), Payload::Project(project)) = (&action, &reply.payload)
            && project.builds_available
            && self.builds.setup(project.id).is_err()
        {
            tracing::warn!(project = %project.id, "initial build could not be scheduled");
        }
        for effect in reply.effects.drain(..) {
            match effect {
                Effect::Mail(message) => self.mailer.send(&message).context("deliver mail")?,
            }
        }
        Ok(reply)
    }

    fn session(&self, identity: &Identity) -> Result<SessionView> {
        let mut workspace_ids = Vec::new();
        let mut integration = None;
        self.transact(true, &mut |queries| {
            workspace_ids = queries
                .user_memberships(identity.user.id)
                .context("user memberships query")?
                .into_iter()
                .map(|m| m.organization_id)
                .collect();
            integration = queries
                .integration(IntegrationSubject::User(identity.user.id))
                .context("integration query")?;
            Ok(())
        })?;
        Ok(SessionView {
            user: projection::user(identity.user.clone(), integration),
            csrf_token: identity.session.csrf_token.clone(),
            workspace_ids,
        })
    }
}
