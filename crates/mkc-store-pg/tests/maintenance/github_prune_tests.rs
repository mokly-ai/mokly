//! GitHub retention removes only expired flows and old terminal deliveries.

use chrono::{Duration, Utc};
use diesel::RunQueryDsl;
use diesel::sql_query;
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::fixtures::database;

#[test]
fn github_pruning_uses_inclusive_cutoffs_and_preserves_active_deliveries() {
    let Some(mut db) = database() else { return };
    let now = Utc::now();
    let flow_cutoff = now - Duration::days(1);
    let delivery_cutoff = now - Duration::days(30);
    for (index, offset) in [-1, 0, 1].into_iter().enumerate() {
        sql_query(format!(
            "INSERT INTO github_oauth_flows
             (state_hash, verifier_hash, purpose, return_to, expires_at)
             VALUES ('{:064x}', '{:064x}', 'sign-in', '/app', $1)",
            index + 1,
            index + 11
        ))
        .bind::<diesel::sql_types::Timestamptz, _>(flow_cutoff + Duration::seconds(offset))
        .execute(&mut db.connection)
        .unwrap();
    }
    for (index, (status, offset)) in [
        ("done", -1),
        ("ignored", 0),
        ("failed", 0),
        ("pending", -1),
        ("processing", -1),
        ("done", 1),
    ]
    .into_iter()
    .enumerate()
    {
        let id = Uuid::from_u128(index as u128 + 1);
        let lease = (status == "processing").then(Uuid::now_v7);
        sql_query(
            "INSERT INTO github_webhook_deliveries
             (id, event, body, received_at, due_at, attempts, status, lease, lease_until)
             VALUES ($1, 'push', '\\x7b7d', $2, $2, 0, $3, $4, $5)",
        )
        .bind::<diesel::sql_types::Uuid, _>(id)
        .bind::<diesel::sql_types::Timestamptz, _>(delivery_cutoff + Duration::seconds(offset))
        .bind::<diesel::sql_types::Text, _>(status)
        .bind::<diesel::sql_types::Nullable<diesel::sql_types::Uuid>, _>(lease)
        .bind::<diesel::sql_types::Nullable<diesel::sql_types::Timestamptz>, _>(
            lease.map(|_| now + Duration::minutes(5)),
        )
        .execute(&mut db.connection)
        .unwrap();
    }
    db.store
        .transaction(&mut Callback(&mut |queries| {
            assert_eq!(queries.prune_github_oauth_flows(flow_cutoff, 1000)?, 2);
            assert_eq!(queries.prune_github_deliveries(delivery_cutoff, 2)?, 2);
            assert_eq!(queries.prune_github_deliveries(delivery_cutoff, 2)?, 1);
            assert_eq!(queries.prune_github_oauth_flows(flow_cutoff, 1000)?, 0);
            assert_eq!(queries.prune_github_deliveries(delivery_cutoff, 2)?, 0);
            Ok(())
        }))
        .unwrap();
}
