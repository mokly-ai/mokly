//! Browser-authorized desktop sign-in and inherited session deadlines.

use chrono::Duration;
use mkc_domain::validation;
use mkc_store_interface::desktop_grant::DesktopGrant;
use subtle::ConstantTimeEq;

use crate::desktop_grant_policy::{credential, s256_challenge, valid_challenge};
use crate::error::{Error, ErrorResultExt, Result};
use crate::links::admit;
use crate::runtime::hash;
use crate::service::{AuthService, DesktopGrantIssued, Identity, LinkVerified, SessionIssued};
use crate::session_policy::{expired, new_session_until};

impl AuthService {
    pub(crate) fn issue_desktop(
        &self,
        identity: &Identity,
        challenge: &str,
        return_to: Option<&str>,
        peer: &str,
    ) -> Result<DesktopGrantIssued> {
        self.admit_desktop("issue", peer)?;
        if !valid_challenge(challenge) {
            return Err(Error::InvalidDesktopGrant);
        }
        let now = self.runtime.now();
        if expired(&identity.session, now) {
            return Err(Error::SessionExpired);
        }
        let grant = self.runtime.secret().context("generate desktop grant")?;
        let record = DesktopGrant {
            token_hash: hash(&grant),
            challenge: challenge.to_owned(),
            user_id: identity.user.id,
            return_to: validation::return_to(return_to),
            expires_at: (now + Duration::minutes(5)).min(identity.session.expires_at),
            session_expires_at: identity.session.expires_at,
            used_at: None,
        };
        self.transact(false, &mut |queries| {
            queries
                .insert_desktop_grant(&record)
                .context("insert desktop grant query")
        })?;
        Ok(DesktopGrantIssued {
            grant,
            expires_at: record.expires_at,
        })
    }

    pub(crate) fn exchange_desktop(
        &self,
        grant: &str,
        verifier: &str,
        previous: Option<&str>,
        peer: &str,
    ) -> Result<LinkVerified> {
        self.admit_desktop("exchange", peer)?;
        if !credential(grant) || !credential(verifier) {
            return Err(Error::InvalidDesktopGrant);
        }
        let supplied_challenge = s256_challenge(verifier);
        let token_hash = hash(grant);
        let credential = self
            .runtime
            .secret()
            .context("generate session credential")?;
        let csrf = self.runtime.secret().context("generate session CSRF")?;
        let mut output = None;
        self.transact(false, &mut |queries| {
            let record = queries
                .desktop_grant(&token_hash)
                .context("lock desktop grant query")?
                .ok_or(Error::InvalidDesktopGrant)?;
            let now = self.runtime.now();
            let matches = bool::from(
                record
                    .challenge
                    .as_bytes()
                    .ct_eq(supplied_challenge.as_bytes()),
            );
            if !matches
                || record.used_at.is_some()
                || now >= record.expires_at
                || now >= record.session_expires_at
            {
                return Err(Error::InvalidDesktopGrant);
            }
            if !queries
                .consume_desktop_grant(&token_hash, now)
                .context("consume desktop grant query")?
            {
                return Err(Error::InvalidDesktopGrant);
            }
            let user = queries
                .user(record.user_id)
                .context("desktop grant user query")?
                .ok_or(Error::InvalidDesktopGrant)?;
            let session =
                new_session_until(user.id, &credential, &csrf, now, record.session_expires_at);
            let session = self.save_replacement(queries, session, previous)?;
            output = Some((Identity { session, user }, record.return_to));
            Ok(())
        })?;
        let (identity, return_to) = output.ok_or(Error::InvalidDesktopGrant)?;
        Ok(LinkVerified {
            session: SessionIssued {
                identity,
                credential,
            },
            return_to,
        })
    }

    fn admit_desktop(&self, endpoint: &str, peer: &str) -> Result<()> {
        let now = self.runtime.now();
        let key = hash(&format!("desktop-grant-{endpoint}:{peer}"));
        self.transact(false, &mut |queries| admit(queries, &key, now, 20))
    }
}
