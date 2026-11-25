//! Expiry, revocation, rotation and browser request binding.

use chrono::{DateTime, Duration, Utc};
use mkc_domain::client_origins::ClientOrigin;
use mkc_domain::ids::UserId;
use mkc_store_interface::session::Session;
use mkc_store_interface::store::{Callback, Queries};
use mkc_store_interface::user::User;
use subtle::ConstantTimeEq;

use crate::error::{Error, ErrorResultExt, Result};
use crate::runtime::hash;
use crate::service::{
    AuthService, Authenticator, DesktopGrantIssued, Identity, LinkIssued, LinkVerified,
    SessionIssued,
};
use crate::session_policy;

impl Authenticator for AuthService {
    fn issue(
        &self,
        email: &str,
        return_to: Option<&str>,
        peer: &str,
        client: ClientOrigin,
    ) -> Result<LinkIssued> {
        self.issue_link(email, return_to, peer, client)
    }

    fn verify(&self, token: &str, previous: Option<&str>) -> Result<LinkVerified> {
        self.verify_link(token, previous)
    }

    fn preview_sign_in_available(&self) -> bool {
        self.preview_sign_in.is_some()
    }

    fn preview_password_account(&self) -> Option<&str> {
        let configured = self.preview_sign_in.as_ref()?;
        configured.verifier.as_ref()?;
        Some(&configured.email)
    }

    fn preview_account(&self) -> Result<User> {
        self.configured_preview_account()
    }

    fn preview(&self, password: &str, previous: Option<&str>, peer: &str) -> Result<SessionIssued> {
        self.preview_sign_in(password, previous, peer)
    }

    fn issue_desktop_grant(
        &self,
        identity: &Identity,
        challenge: &str,
        return_to: Option<&str>,
        peer: &str,
    ) -> Result<DesktopGrantIssued> {
        self.issue_desktop(identity, challenge, return_to, peer)
    }

    fn exchange_desktop_grant(
        &self,
        grant: &str,
        verifier: &str,
        previous: Option<&str>,
        peer: &str,
    ) -> Result<LinkVerified> {
        self.exchange_desktop(grant, verifier, previous, peer)
    }

    fn authenticate(&self, credential: &str) -> Result<Identity> {
        let now = self.runtime.now();
        let mut output = None;
        self.transact(true, &mut |queries| {
            output = Some(resolve(queries, &hash(credential), now)?);
            Ok(())
        })?;
        let mut identity = output.ok_or(Error::Unauthenticated)?;
        let before = now - Duration::minutes(5);
        if identity.session.last_seen_at < before {
            self.store
                .autocommit(&mut Callback(&mut |queries| {
                    queries.touch(&identity.session.token_hash, now, before)
                }))
                .context("touch session activity")?;
            identity.session.last_seen_at = now;
        }
        Ok(identity)
    }

    fn rotate(&self, credential: &str) -> Result<SessionIssued> {
        let now = self.runtime.now();
        let fresh = self.runtime.secret().context("generate credential")?;
        let csrf_token = self.runtime.secret().context("generate credential")?;
        let mut output = None;
        self.transact(false, &mut |queries| {
            let mut identity = resolve(queries, &hash(credential), now)?;
            queries
                .delete_session(&identity.session.token_hash)
                .context("delete session query")?;
            identity.session = Session {
                token_hash: hash(&fresh),
                csrf_token: csrf_token.clone(),
                last_seen_at: now,
                ..identity.session
            };
            queries
                .insert_session(&identity.session)
                .context("insert session query")?;
            output = Some(identity);
            Ok(())
        })?;
        Ok(SessionIssued {
            identity: output.ok_or(Error::Unauthenticated)?,
            credential: fresh,
        })
    }

    fn sign_out(&self, credential: &str) -> Result<()> {
        self.transact(false, &mut |queries| {
            queries
                .delete_session(&hash(credential))
                .context("delete session query")
        })
    }

    fn csrf(
        &self,
        identity: &Identity,
        origin: Option<&str>,
        token: Option<&str>,
    ) -> Result<ClientOrigin> {
        let client = self.origin(origin)?;
        let token = token.ok_or(Error::CsrfFailed)?;
        if !bool::from(
            identity
                .session
                .csrf_token
                .as_bytes()
                .ct_eq(token.as_bytes()),
        ) {
            return Err(Error::CsrfFailed);
        }
        Ok(client)
    }

    fn origin(&self, origin: Option<&str>) -> Result<ClientOrigin> {
        self.origins.classify(origin).ok_or(Error::CsrfFailed)
    }
}

impl AuthService {
    /// Reuse an account by normalized email or create its verified identity.
    pub(crate) fn find_or_create_user(
        &self,
        queries: &mut dyn Queries,
        email: &str,
        user_id: UserId,
        now: DateTime<Utc>,
    ) -> Result<User> {
        match queries.find_user(email).context("find user query")? {
            Some(user) => Ok(user),
            None => {
                let user = User {
                    id: user_id,
                    email: email.to_owned(),
                    name: email.to_owned(),
                    created_at: now,
                };
                queries.insert_user(&user).context("insert user query")?;
                Ok(user)
            }
        }
    }

    /// Revoke an optional prior credential and issue its replacement atomically.
    pub(crate) fn replace_session(
        &self,
        queries: &mut dyn Queries,
        user: UserId,
        credential: &str,
        csrf_token: &str,
        now: DateTime<Utc>,
        previous: Option<&str>,
    ) -> Result<Session> {
        let session = session_policy::new_session(user, credential, csrf_token, now);
        self.save_replacement(queries, session, previous)
    }

    /// Persist a chosen session deadline and revoke its predecessor in one transaction.
    pub(crate) fn save_replacement(
        &self,
        queries: &mut dyn Queries,
        session: Session,
        previous: Option<&str>,
    ) -> Result<Session> {
        if let Some(previous) = previous {
            queries
                .delete_session(&hash(previous))
                .context("delete session query")?;
        }
        queries
            .insert_session(&session)
            .context("insert session query")?;
        Ok(session)
    }
}

fn resolve(queries: &mut dyn Queries, hash: &str, now: DateTime<Utc>) -> Result<Identity> {
    let session = queries
        .session(hash)
        .context("session query")?
        .ok_or(Error::Unauthenticated)?;
    if session_policy::expired(&session, now) {
        return Err(Error::SessionExpired);
    }
    let user = queries
        .user(session.user_id)
        .context("user query")?
        .ok_or(Error::Unauthenticated)?;
    Ok(Identity { session, user })
}
