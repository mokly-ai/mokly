//! Inclusive expiry windows retain active credentials and replay diagnostics.

use std::time;

use chrono::{Duration, Utc};
use mkc_store_interface::auth_prune::PruneBatch;
use mkc_store_interface::magic_link::MagicLink;
use mkc_store_interface::rate_limit::RateLimit;
use mkc_store_interface::session::Session;
use mkc_store_interface::store::Callback;
use mkc_store_interface::user::User;
use uuid::Uuid;

use super::fixtures::database;

#[test]
fn pruning_respects_link_session_idle_and_counter_windows() {
    let Some(db) = database() else { return };
    let batch = PruneBatch {
        limit: 2,
        timeout: time::Duration::from_secs(5),
    };
    let counters = PruneBatch { limit: 1, ..batch };
    let now = Utc::now();
    let link_cutoff = now - Duration::days(7);
    let expiry_cutoff = now - Duration::days(1);
    let idle_cutoff = now - Duration::days(8);
    let user = User {
        id: Uuid::now_v7().into(),
        email: "maintenance@example.com".into(),
        name: "Maintenance".into(),
        created_at: now,
    };
    db.store
        .transaction(&mut Callback(&mut |q| {
            q.insert_user(&user)?;
            for (index, delta) in [-1, 0, 1, 8 * 86_400].into_iter().enumerate() {
                for used in [false, true] {
                    q.insert_magic_link(&MagicLink {
                        token_hash: format!("{:064x}", index * 2 + usize::from(used)),
                        email: user.email.clone(),
                        return_to: "/dashboard".into(),
                        expires_at: link_cutoff + Duration::seconds(delta),
                        used_at: used.then_some(link_cutoff - Duration::minutes(1)),
                    })?;
                }
                q.insert_rate_limit(&RateLimit {
                    key: index.to_string(),
                    count: 1,
                    resets_at: expiry_cutoff + Duration::seconds(delta),
                })?;
                q.insert_session(&Session {
                    token_hash: format!("{index:064x}"),
                    user_id: user.id,
                    csrf_token: "csrf".into(),
                    created_at: now - Duration::days(30),
                    expires_at: expiry_cutoff + Duration::seconds(delta),
                    last_seen_at: now,
                })?;
                q.insert_session(&Session {
                    token_hash: format!("{:064x}", index + 4),
                    user_id: user.id,
                    csrf_token: "csrf".into(),
                    created_at: now - Duration::days(30),
                    expires_at: now + Duration::days(1),
                    last_seen_at: idle_cutoff + Duration::seconds(delta),
                })?;
            }
            assert_eq!(q.prune_magic_links(link_cutoff, batch)?, 2);
            assert_eq!(q.prune_magic_links(link_cutoff, batch)?, 2);
            assert_eq!(q.prune_sessions(expiry_cutoff, idle_cutoff, batch)?, 2);
            assert_eq!(q.prune_sessions(expiry_cutoff, idle_cutoff, batch)?, 2);
            assert_eq!(q.prune_rate_limits(expiry_cutoff, counters)?, 1);
            assert_eq!(q.prune_rate_limits(expiry_cutoff, counters)?, 1);
            for index in 0..4 {
                assert_eq!(
                    q.magic_link(&format!("{:064x}", index * 2))?.is_some(),
                    index >= 2
                );
                assert_eq!(
                    q.magic_link(&format!("{:064x}", index * 2 + 1))?.is_some(),
                    index >= 2
                );
                assert_eq!(q.session(&format!("{index:064x}"))?.is_some(), index >= 2);
                assert_eq!(
                    q.session(&format!("{:064x}", index + 4))?.is_some(),
                    index >= 2
                );
                assert_eq!(q.rate_limit(&index.to_string())?.is_some(), index >= 2);
            }
            assert_eq!(q.prune_magic_links(link_cutoff, batch)?, 0);
            assert_eq!(q.prune_sessions(expiry_cutoff, idle_cutoff, batch)?, 0);
            assert_eq!(q.prune_rate_limits(expiry_cutoff, counters)?, 0);
            Ok(())
        }))
        .unwrap();
}
