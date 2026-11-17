//! Pure session construction and lifetime policy shared by verified sign-in flows.

use chrono::{DateTime, Duration, Utc};
use mkc_domain::ids::UserId;
use mkc_store_interface::session::Session;

use crate::runtime::hash;

/// Shared idle-expiry interval for authentication and pruning.
pub const IDLE_LIFETIME: Duration = Duration::days(7);

/// Construct a session record after a service has verified the user's identity.
pub fn new_session(user: UserId, credential: &str, csrf: &str, now: DateTime<Utc>) -> Session {
    Session {
        token_hash: hash(credential),
        user_id: user,
        csrf_token: csrf.to_owned(),
        created_at: now,
        expires_at: now + Duration::days(30),
        last_seen_at: now,
    }
}

/// Exclusive absolute and idle expiry boundaries for any sign-in provider.
pub fn expired(session: &Session, now: DateTime<Utc>) -> bool {
    now >= session.expires_at || now >= session.last_seen_at + IDLE_LIFETIME
}
