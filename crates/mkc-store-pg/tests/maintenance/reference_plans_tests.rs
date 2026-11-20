//! Newest-attempt lookups stay bounded with long reference histories.

use chrono::{DateTime, Utc};
use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sql_types::{self, BigInt, Bool, Nullable, Text, Timestamptz};
use uuid::Uuid;

use super::fixtures::database;

#[derive(QueryableByName)]
struct PlanLine {
    #[diesel(sql_type = Text, column_name = "QUERY PLAN")]
    value: String,
}

fn assert_bounded_probe(lines: Vec<PlanLine>, index: &str) {
    let output = lines
        .iter()
        .map(|line| line.value.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    println!("{index}, 50 references with 1000 attempts each:\n{output}");
    assert!(
        lines.windows(2).any(|pair| {
            pair[0].value.contains("Limit (actual rows=1 loops=50)")
                && pair[1].value.contains(index)
                && pair[1].value.contains("actual rows=1 loops=50")
        }),
        "newest attempt must use a single-row indexed probe: {output}"
    );
}

#[test]
fn reference_summaries_probe_one_indexed_attempt_per_reference() {
    let Some(mut db) = database() else { return };
    db.connection
        .batch_execute(include_str!("reference_history.sql"))
        .unwrap();
    let branches = diesel::sql_query(format!(
        "EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF) {}",
        include_str!("../../src/viewer/branches.sql")
    ))
    .bind::<sql_types::Uuid, _>(Uuid::from_u128(2))
    .bind::<Nullable<Bool>, _>(None::<bool>)
    .bind::<Nullable<Text>, _>(None::<String>)
    .bind::<BigInt, _>(50_i64)
    .load::<PlanLine>(&mut db.connection)
    .unwrap();
    assert_bounded_probe(branches, "publications_viewer_branch_attempt");
    let pulls = diesel::sql_query(format!(
        "EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF) {}",
        include_str!("../../src/viewer/pull_requests.sql")
    ))
    .bind::<sql_types::Uuid, _>(Uuid::from_u128(2))
    .bind::<Nullable<Bool>, _>(None::<bool>)
    .bind::<Nullable<Timestamptz>, _>(None::<DateTime<Utc>>)
    .bind::<Nullable<BigInt>, _>(None::<i64>)
    .bind::<BigInt, _>(50_i64)
    .load::<PlanLine>(&mut db.connection)
    .unwrap();
    assert_bounded_probe(pulls, "publications_viewer_pr_attempt");
}
