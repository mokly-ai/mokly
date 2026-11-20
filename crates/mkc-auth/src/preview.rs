//! Persistent admission and credential verification for preview sign-in.

use mkc_store_interface::user::User;
use subtle::ConstantTimeEq;

use crate::error::{Error, ErrorResultExt, Result};
use crate::links::admit;
use crate::runtime::hash;
use crate::service::{AuthService, Identity, SessionIssued};

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

    /// Commit peer admission before validating the reusable preview credential.
    pub(crate) fn preview_sign_in(
        &self,
        secret: &str,
        previous: Option<&str>,
        peer: &str,
    ) -> Result<SessionIssued> {
        let configured = self
            .preview_sign_in
            .as_ref()
            .ok_or(Error::PreviewSignInUnavailable)?;
        let now = self.runtime.now();
        self.transact(false, &mut |queries| {
            admit(queries, &hash(&format!("preview:{peer}")), now, 20)
        })?;
        let supplied_hash = hash(secret);
        let well_formed = secret.len() == 64
            && secret
                .bytes()
                .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase());
        let matches = bool::from(
            configured
                .secret_hash
                .as_bytes()
                .ct_eq(supplied_hash.as_bytes()),
        );
        if !well_formed || !matches {
            return Err(Error::InvalidLink);
        }
        let credential = self.runtime.secret().context("generate credential")?;
        let csrf_token = self.runtime.secret().context("generate credential")?;
        let user_id = self.runtime.id().into();
        let mut output = None;
        self.transact(false, &mut |queries| {
            let user = self.find_or_create_user(queries, &configured.email, user_id, now)?;
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
