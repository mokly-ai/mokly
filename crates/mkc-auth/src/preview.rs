//! Persistent admission and session issuance for preview sign-in.

use std::sync::Arc;

use chrono::{DateTime, Utc};
use mkc_store_interface::user::User;

use crate::error::{Error, ErrorResultExt, Result};
use crate::links::admit;
use crate::runtime::hash;
use crate::service::{AuthService, Identity, PreviewPasswordCheck, SessionIssued};

impl AuthService {
    /// Reuse the configured preview identity without admission or session issuance.
    pub(crate) fn configured_preview_account(&self) -> Result<User> {
        let configured = self
            .preview_sign_in
            .as_ref()
            .ok_or(Error::PreviewSignInUnavailable)?;
        let now = self.runtime.now();
        let user_id = self.runtime.id().into();
        let mut output = None;
        self.transact(false, &mut |queries| {
            output = Some(self.find_or_create_user(queries, &configured.email, user_id, now)?);
            Ok(())
        })?;
        output.ok_or(Error::Unauthenticated)
    }

    /// Commit peer admission before returning the work that checks the password.
    pub(crate) fn preview_sign_in(
        self: Arc<Self>,
        previous: Option<String>,
        peer: &str,
    ) -> Result<PreviewPasswordCheck> {
        let configured = self
            .preview_sign_in
            .as_ref()
            .ok_or(Error::PreviewSignInUnavailable)?;
        let now = self.runtime.now();
        self.transact(false, &mut |queries| {
            admit(queries, &hash(&format!("preview:{peer}")), now, 20)
        })?;
        let verifier = configured.verifier.clone().ok_or(Error::InvalidLink)?;
        let email = configured.email.clone();
        Ok(Box::new(move |password| {
            if !verifier.matches(password) {
                return Err(Error::InvalidLink);
            }
            Ok(Box::new(move || {
                self.issue_preview_session(&email, previous.as_deref(), now)
            }))
        }))
    }

    fn issue_preview_session(
        &self,
        email: &str,
        previous: Option<&str>,
        now: DateTime<Utc>,
    ) -> Result<SessionIssued> {
        let credential = self.runtime.secret().context("generate credential")?;
        let csrf_token = self.runtime.secret().context("generate credential")?;
        let user_id = self.runtime.id().into();
        let mut output = None;
        self.transact(false, &mut |queries| {
            let user = self.find_or_create_user(queries, email, user_id, now)?;
            let session =
                self.replace_session(queries, user.id, &credential, &csrf_token, now, previous)?;
            output = Some(Identity { session, user });
            Ok(())
        })?;
        Ok(SessionIssued {
            identity: output.ok_or(Error::Unauthenticated)?,
            credential,
        })
    }
}
