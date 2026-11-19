//! Link admission and single-use verification transactions.

use chrono::Duration;
use mkc_domain::client_origins::ClientOrigin;
use mkc_domain::{app_paths, validation};
use mkc_email_interface::mail::{Content, Lifetime, Message};
use mkc_store_interface::magic_link::MagicLink;
use mkc_store_interface::rate_limit::RateLimit;
use mkc_store_interface::store::Queries;

use crate::error::{Error, ErrorResultExt, Result};
use crate::runtime::hash;
use crate::service::{AuthService, Identity, LinkIssued, LinkVerified, SessionIssued};

const LINK_LIFETIME_MINUTES: u32 = 15;

impl AuthService {
    pub(crate) fn issue_link(
        &self,
        email: &str,
        return_to: Option<&str>,
        peer: &str,
        _client: ClientOrigin,
    ) -> Result<LinkIssued> {
        let email = validation::email(email).ok_or(Error::InvalidInput)?;
        let now = self.runtime.now();
        let token = self.runtime.secret().context("generate credential")?;
        let request_id = self.runtime.id();
        let link = MagicLink {
            token_hash: hash(&token),
            email: email.clone(),
            return_to: validation::return_to(return_to),
            expires_at: now + Duration::minutes(i64::from(LINK_LIFETIME_MINUTES)),
            used_at: None,
        };
        self.transact(false, &mut |queries| {
            admit(queries, &hash(&format!("email:{email}")), now, 1)?;
            admit(queries, &hash(&format!("peer:{peer}")), now, 20)?;
            queries
                .insert_magic_link(&link)
                .context("insert magic link query")
        })?;
        self.mailer
            .send(&Message {
                recipient: email,
                content: Content::SignIn {
                    link: format!(
                        "{}#token={token}",
                        app_paths::on_origin(self.origins.app_origin(), app_paths::EMAIL_CALLBACK)
                    ),
                    valid_for: Lifetime::Minutes(LINK_LIFETIME_MINUTES),
                },
            })
            .context("deliver sign-in link")?;
        Ok(LinkIssued {
            request_id,
            resend_after: now + Duration::seconds(60),
        })
    }

    pub(crate) fn verify_link(&self, token: &str, previous: Option<&str>) -> Result<LinkVerified> {
        if token.len() != 64
            || !token
                .bytes()
                .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
        {
            return Err(Error::InvalidLink);
        }
        let now = self.runtime.now();
        let credential = self.runtime.secret().context("generate credential")?;
        let csrf_token = self.runtime.secret().context("generate credential")?;
        let user_id = self.runtime.id().into();
        let mut output = None;
        self.transact(false, &mut |queries| {
            let mut link = queries
                .magic_link(&hash(token))
                .context("magic link query")?
                .ok_or(Error::InvalidLink)?;
            if link.used_at.is_some() {
                return Err(Error::LinkUsed);
            }
            if now >= link.expires_at {
                return Err(Error::LinkExpired);
            }
            let user = self.find_or_create_user(queries, &link.email, user_id, now)?;
            link.used_at = Some(now);
            queries
                .save_magic_link(&link)
                .context("save magic link query")?;
            let session =
                self.replace_session(queries, user.id, &credential, &csrf_token, now, previous)?;
            output = Some((Identity { session, user }, link.return_to));
            Ok(())
        })?;
        let (identity, return_to) = output.ok_or(Error::Unauthenticated)?;
        Ok(LinkVerified {
            session: SessionIssued {
                identity,
                credential,
            },
            return_to,
        })
    }
}

/// Consume one admission in a persistent fixed window.
pub(crate) fn admit(
    queries: &mut dyn Queries,
    key: &str,
    now: chrono::DateTime<chrono::Utc>,
    limit: i64,
) -> Result<()> {
    let old = queries.rate_limit(key).context("rate limit query")?;
    let record = match &old {
        Some(record) if now < record.resets_at => {
            if record.count >= limit {
                return Err(Error::RateLimited(
                    (record.resets_at - now).num_seconds().max(1),
                ));
            }
            RateLimit {
                count: record.count + 1,
                ..record.clone()
            }
        }
        _ => RateLimit {
            key: key.to_owned(),
            count: 1,
            resets_at: now + Duration::seconds(60),
        },
    };
    if old.is_some() {
        queries
            .save_rate_limit(&record)
            .context("save rate limit query")
    } else {
        queries
            .insert_rate_limit(&record)
            .context("insert rate limit query")
    }
}
