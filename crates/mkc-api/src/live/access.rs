//! Upgrade authentication and non-touching reads of the original session.

use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_auth::service::Authenticator;
use mkc_auth::session_policy::expired;
use mkc_domain::ids::{ProjectId, UserId};
use mkc_store_interface::store::{Queries, Store};

use crate::builds::reads::member_role;
use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::store_work::ApiWork;

pub(crate) trait SocketAccess: Send + Sync {
    fn open(
        &self,
        project: ProjectId,
        origin: Option<&str>,
        credential: Option<&str>,
    ) -> Result<LiveSession>;

    fn recheck(&self, session: &LiveSession) -> Result<()>;
}

pub(crate) struct LiveSession {
    pub(super) project: ProjectId,
    pub(super) user: UserId,
    hash: String,
}

pub(crate) struct DatabaseSocketAccess {
    pub(crate) auth: Arc<dyn Authenticator>,
    pub(crate) store: Arc<dyn Store>,
    pub(crate) runtime: Arc<dyn Runtime>,
}

impl SocketAccess for DatabaseSocketAccess {
    fn open(
        &self,
        project: ProjectId,
        origin: Option<&str>,
        credential: Option<&str>,
    ) -> Result<LiveSession> {
        self.auth.origin(origin)?;
        let identity = self
            .auth
            .authenticate(credential.ok_or(ApiError::Unauthenticated)?)?;
        let user = identity.user.id;
        self.read(&mut |queries| {
            member_role(queries, Some(user), project)?;
            Ok(())
        })?;
        Ok(LiveSession {
            project,
            user,
            hash: identity.session.token_hash,
        })
    }

    fn recheck(&self, session: &LiveSession) -> Result<()> {
        let now = self.runtime.now();
        self.read(&mut |queries| {
            let current = queries
                .session(&session.hash)
                .context("read live session")?
                .filter(|current| current.user_id == session.user)
                .ok_or(ApiError::Unauthenticated)?;
            if expired(&current, now) {
                return Err(ApiError::SessionExpired);
            }
            member_role(queries, Some(session.user), session.project)?;
            Ok(())
        })
    }
}

impl DatabaseSocketAccess {
    fn read(&self, operation: &mut dyn FnMut(&mut dyn Queries) -> Result<()>) -> Result<()> {
        let mut work = ApiWork::new(operation);
        self.store.read(&mut work).context("read live access")?;
        work.finish()
    }
}
