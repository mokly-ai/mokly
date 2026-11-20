//! Terminal build retention, child cascades and failed upload reference release.

use chrono::Duration;
use diesel::prelude::*;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_store_interface::blob::{Blob, PublicationFile};
use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::grant_tests::grant;
use super::log_tests::chunk;
use super::support::{attempt, fixture};

#[test]
fn retention_deletes_failed_uploads_and_children_but_keeps_ready_and_expired_history() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let a = attempt(f.now);
    let g = grant(b.id, &a);
    let ready = f.publication(&b);
    let mut expired = ready.clone();
    expired.id = Uuid::now_v7().into();
    expired.build_failure_event_id = Some(Uuid::now_v7());
    expired.state = PublicationState::Expired;
    expired.expired_at = Some(f.now);
    let mut failed = ready.clone();
    failed.id = Uuid::now_v7().into();
    failed.build_failure_event_id = Some(Uuid::now_v7());
    failed.state = PublicationState::Validating;
    failed.changes = None;
    let content = Blob {
        project_id: f.project.id,
        key: BlobKey {
            hash: BlobHash::digest(b"retention"),
            incarnation: Uuid::now_v7(),
        },
        size: 9,
        content_type: "text/plain".into(),
        ref_count: 0,
        deleting: false,
        unreferenced_at: Some(f.now),
        stored_at: None,
    };
    let file = PublicationFile {
        publication_id: failed.id,
        project_id: f.project.id,
        path: "index.html".into(),
        key: content.key.clone(),
        size: content.size,
        content_type: content.content_type.clone(),
    };
    let active = f.build("active", 2);
    f.schedule(&active);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(b.id, &a)?.unwrap();
            q.mint_build_grant(&g)?;
            q.append_build_log(b.id, &chunk(a.operation_id, b"log".to_vec(), f.now))?;
            q.insert_publication(&ready)?;
            q.insert_publication(&expired)?;
            q.insert_publication(&failed)?;
            q.insert_blob(&content)?;
            q.insert_publication_file(&file)?;
            q.fail_publication(failed.id, PublicationFailure::InvalidBundle)?;
            q.cancel_build(f.project.id, b.id, f.now)?;
            assert_eq!(q.prune_builds(f.now - Duration::seconds(1), 1000)?, 0);
            assert_eq!(q.prune_builds(f.now, 1)?, 1);
            assert!(q.build(f.project.id, b.id)?.is_none());
            assert!(q.build(f.project.id, active.id)?.is_some());
            assert!(q.build_grant(&g.token_digest)?.is_none());
            assert!(q.publication(failed.id)?.is_none());
            for p in [&ready, &expired] {
                assert!(q.publication(p.id)?.unwrap().build_id.is_none());
            }
            assert_eq!(
                q.blob(f.project.id, &content.key.hash)?.unwrap().ref_count,
                0
            );
            assert!(
                q.pending_build_checks(f.now, 100, None)?
                    .iter()
                    .all(|c| c.build_id != b.id)
            );
            assert_eq!(q.prune_builds(f.now, 1000)?, 0);
            Ok(())
        }))
        .unwrap();
    let mut connection = f.connection();
    let remaining: i64 = mkc_db::schema::build_output::build_log_chunks::table
        .count()
        .get_result(&mut connection)
        .unwrap();
    assert_eq!(remaining, 0);
}

#[test]
fn retention_limits_each_batch_to_1000_in_oldest_finished_order() {
    let Some(f) = fixture() else {
        return;
    };
    let mut connection = f.connection();
    diesel::sql_query(
        "INSERT INTO builds (id, project_id, repository_id, trigger, branch, head_sha,
        config_path, state, next_attempt_at, created_at, finished_at)
        SELECT md5('bulk' || n)::uuid, $1, $2, 'request', 'bulk', lpad(to_hex(n), 40, '0'),
            'mokly.config.ts', 'cancelled', $3, $3, $3 + n * INTERVAL '1 second'
        FROM generate_series(1, 1002) n",
    )
    .bind::<diesel::sql_types::Uuid, _>(f.project.id.0)
    .bind::<diesel::sql_types::Uuid, _>(f.repository.id.0)
    .bind::<diesel::sql_types::Timestamptz, _>(f.now)
    .execute(&mut connection)
    .unwrap();
    f.store
        .transaction(&mut Callback(&mut |q| {
            assert_eq!(q.prune_builds(f.now + Duration::hours(1), 10000)?, 1000);
            Ok(())
        }))
        .unwrap();
    let ids = mkc_db::schema::build::builds::table
        .order(mkc_db::schema::build::builds::finished_at)
        .select(mkc_db::schema::build::builds::head_sha)
        .load::<String>(&mut connection)
        .unwrap();
    assert_eq!(ids, [format!("{:040x}", 1001), format!("{:040x}", 1002)]);
}
