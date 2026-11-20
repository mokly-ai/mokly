//! Retained head and tail caps, cursors, elision and attempt sequence identity.

use chrono::Duration;
use mkc_store_interface::build_log::NewBuildLogChunk;
use mkc_store_interface::build_state::{BuildState, BuildStream};
use mkc_store_interface::store::Callback;

use super::support::{attempt, finish, fixture};

pub(super) fn chunk(
    operation: uuid::Uuid,
    bytes: Vec<u8>,
    at: chrono::DateTime<chrono::Utc>,
) -> NewBuildLogChunk {
    NewBuildLogChunk {
        attempt_operation_id: operation,
        step: None,
        stream: BuildStream::Stdout,
        bytes,
        created_at: at,
    }
}

#[test]
fn cap_preserves_first_256_kib_and_newest_tail_with_exact_elision_counts() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let a = attempt(f.now);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(b.id, &a)?.unwrap();
            for i in 1..=20 {
                assert!(q.append_build_log(b.id, &chunk(a.operation_id, vec![i; 65536], f.now))?);
            }
            let stored = q.build(f.project.id, b.id)?.unwrap();
            assert_eq!(
                (
                    stored.log_bytes,
                    stored.log_head_sequence,
                    stored.log_sequence,
                    stored.log_elided_bytes
                ),
                (1048576, 4, 20, 262144)
            );
            let first = q.build_log(f.project.id, b.id, 0, 100)?.unwrap();
            assert_eq!(
                first.chunks.iter().map(|c| c.sequence).collect::<Vec<_>>(),
                [1, 2, 3, 4]
            );
            assert!(!first.complete);
            assert_eq!(first.elided_bytes, 262144);
            let tail = q
                .build_log(f.project.id, b.id, first.next_after, 2)?
                .unwrap();
            assert_eq!(
                tail.chunks.iter().map(|c| c.sequence).collect::<Vec<_>>(),
                [9, 10]
            );
            assert_eq!(tail.chunks[0].bytes, vec![9; 65536]);
            let stop = finish(f.now, BuildState::Cancelled);
            assert!(q.finish_build(b.id, Some(a.lease_token), &stop)?);
            assert!(!q.build_log(f.project.id, b.id, 0, 100)?.unwrap().complete);
            let end = q.build_log(f.project.id, b.id, 19, 100)?.unwrap();
            assert!(end.complete);
            assert_eq!(end.next_after, 20);
            let empty = q.build_log(f.project.id, b.id, 20, 100)?.unwrap();
            assert!(empty.complete);
            assert!(empty.chunks.is_empty());
            assert_eq!(empty.next_after, 20);
            assert!(
                q.build_log(uuid::Uuid::now_v7().into(), b.id, 0, 100)?
                    .is_none()
            );
            Ok(())
        }))
        .unwrap();
}

#[test]
fn uneven_chunk_crossing_head_boundary_splits_without_losing_bytes() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let a = attempt(f.now);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(b.id, &a)?.unwrap();
            q.append_build_log(b.id, &chunk(a.operation_id, vec![1; 5], f.now))?;
            for _ in 0..4 {
                q.append_build_log(b.id, &chunk(a.operation_id, vec![2; 65536], f.now))?;
            }
            let stored = q.build(f.project.id, b.id)?.unwrap();
            assert_eq!(stored.log_head_sequence, 5);
            assert_eq!(stored.log_sequence, 6);
            assert_eq!(stored.log_bytes, 262149);
            let first = q.build_log(f.project.id, b.id, 0, 100)?.unwrap();
            assert_eq!(first.chunks.len(), 5);
            assert_eq!(
                first.chunks.iter().map(|c| c.bytes.len()).sum::<usize>(),
                262144
            );
            let last = q
                .build_log(f.project.id, b.id, first.next_after, 100)?
                .unwrap();
            assert_eq!(last.chunks[0].bytes, vec![2; 5]);
            Ok(())
        }))
        .unwrap();
}

#[test]
fn sequence_counter_survives_retry_deletion_and_rejects_old_attempt_output() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let old = attempt(f.now);
    let new = attempt(f.now + Duration::seconds(60));
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(b.id, &old)?.unwrap();
            q.append_build_log(b.id, &chunk(old.operation_id, b"first".to_vec(), f.now))?;
            let mut retry = finish(f.now, BuildState::Queued);
            retry.next_attempt_at = new.now;
            assert!(q.finish_build(b.id, Some(old.lease_token), &retry)?);
            assert!(q.append_build_log(b.id, &chunk(old.operation_id, b"last".to_vec(), f.now))?);
            q.start_build(b.id, &new)?.unwrap();
            assert!(
                !q.append_build_log(b.id, &chunk(old.operation_id, b"stale".to_vec(), new.now))?
            );
            assert!(q.append_build_log(b.id, &chunk(new.operation_id, b"new".to_vec(), new.now))?);
            let log = q.build_log(f.project.id, b.id, 2, 100)?.unwrap();
            assert_eq!(log.chunks.len(), 1);
            assert_eq!(log.chunks[0].sequence, 3);
            assert_eq!(log.chunks[0].attempt, 2);
            assert_eq!(log.chunks[0].bytes, b"new");
            assert_eq!((log.head_sequence, log.elided_bytes), (3, 0));
            Ok(())
        }))
        .unwrap();
}
