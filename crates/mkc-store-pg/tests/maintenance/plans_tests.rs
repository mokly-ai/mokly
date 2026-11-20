//! EXPLAIN the production SQL and require indexed eligibility before batching.

use chrono::{Duration, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Nullable, Text, Timestamptz, Uuid as SqlUuid};
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::fixtures::{database, publication_candidate_rows};

#[derive(QueryableByName)]
struct PlanLine {
    #[diesel(sql_type = Text, column_name = "QUERY PLAN")]
    value: String,
}

fn plan(lines: Vec<PlanLine>) -> String {
    lines
        .into_iter()
        .map(|line| line.value)
        .collect::<Vec<_>>()
        .join("\n")
}

/// With sequential scans disabled, this checks cutoff index use rather than representative plan quality.
#[test]
fn production_candidate_queries_use_partial_cutoff_indexes() {
    let Some(mut db) = database() else { return };
    let now = Utc::now();
    publication_candidate_rows(&mut db.connection, now);
    diesel::sql_query("SET enable_seqscan = off")
        .execute(&mut db.connection)
        .unwrap();
    let sql = format!(
        "EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF) {}",
        include_str!("../../src/retention_candidates.sql")
    );
    let output = plan(
        diesel::sql_query(sql)
            .bind::<Timestamptz, _>(now)
            .bind::<Timestamptz, _>(now - Duration::days(30))
            .bind::<Nullable<SqlUuid>, _>(None::<Uuid>)
            .bind::<BigInt, _>(100_i64)
            .load::<PlanLine>(&mut db.connection)
            .unwrap(),
    );
    println!("Publication candidates:\n{output}");
    assert!(output.contains("publications_attempt_deadline"), "{output}");
    assert!(output.contains("publications_failed_age"), "{output}");
    assert!(output.contains("Index Cond: (deadline <="), "{output}");
    assert!(output.contains("Index Cond: (created_at <="), "{output}");
    assert!(!output.contains("Rows Removed by Filter"), "{output}");

    diesel::sql_query(
        "INSERT INTO blobs (project_id, hash, incarnation, size, content_type, unreferenced_at, deleting)
        SELECT '00000000-0000-0000-0000-000000000002', lpad(n::text, 64, '0'),
        '00000000-0000-0000-0000-000000000001', 0, 'text/plain',
        CASE WHEN n = 199 THEN $1::timestamptz - interval '24 hours' ELSE $1 END, n = 200
        FROM generate_series(1, 200) n",
    )
    .bind::<Timestamptz, _>(now)
    .execute(&mut db.connection)
    .unwrap();
    db.store
        .read(&mut Callback(&mut |q| {
            let candidates = q.garbage_blobs(now - Duration::hours(24), 100)?;
            assert_eq!(candidates.len(), 2);
            assert!(candidates[0].key.hash.as_str().ends_with("199"));
            assert!(candidates[1].deleting);
            Ok(())
        }))
        .unwrap();
    let sql = format!(
        "EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF) {}",
        include_str!("../../src/garbage_candidates.sql")
    );
    let output = plan(
        diesel::sql_query(sql)
            .bind::<Timestamptz, _>(now - Duration::hours(24))
            .bind::<BigInt, _>(100_i64)
            .load::<PlanLine>(&mut db.connection)
            .unwrap(),
    );
    println!("Blob candidates:\n{output}");
    assert!(output.contains("blobs_collection_grace"), "{output}");
    assert!(output.contains("blobs_collection_retry"), "{output}");
    assert!(
        output.contains("Index Cond: (unreferenced_at <="),
        "{output}"
    );
    assert!(!output.contains("Rows Removed by Filter"), "{output}");
}

#[test]
fn github_retention_filters_by_cutoff_before_each_limit() {
    let Some(mut db) = database() else { return };
    let now = Utc::now();
    diesel::sql_query("SET enable_seqscan = off")
        .execute(&mut db.connection)
        .unwrap();
    for (sql, index) in [
        (
            include_str!("../../src/github_oauth_retention.sql"),
            "github_flows_expiry",
        ),
        (
            include_str!("../../src/github_delivery_retention.sql"),
            "github_delivery_retention",
        ),
    ] {
        let output = plan(
            diesel::sql_query(format!("EXPLAIN (COSTS OFF) {sql}"))
                .bind::<Timestamptz, _>(now)
                .bind::<BigInt, _>(1000_i64)
                .load::<PlanLine>(&mut db.connection)
                .unwrap(),
        );
        assert!(output.contains(index), "{output}");
        assert!(output.contains("Index Cond:"), "{output}");
    }
}
