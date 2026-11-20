//! Every ending overlaps the complete ready write, observations, event and consumption.

use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use diesel::prelude::*;
use mkc_db::schema::publication_screens::publication_screen_views;
use mkc_publications::error::Error;
use mkc_store_interface::build_state::BuildState;
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::publication_event::EventKind;

use super::endings::Ending;
use super::fixture::Upload;
use super::locks;

fn completion_first(ending: Ending) {
    let Some(upload) = Upload::create() else {
        return;
    };
    let f = &upload.fixture;
    let mut gate = f.connection();
    let mut observer = f.connection();
    let key = locks::gate(&mut gate);
    let ingest = upload.ingest.clone();
    let authorization = upload.authorization.clone();
    let id = upload.publication.id;
    let completing = thread::spawn(move || {
        let result = ingest.complete(authorization, id);
        if let Err(error) = &result {
            eprintln!("completion error: {error:?}");
        }
        result
    });
    let completion_pid = locks::gated_pid(&mut observer, key);
    let transactions = f.transactions.clone();
    let build = upload.build.clone();
    let at = upload.attempt.lease_expires_at;
    let (done_tx, done_rx) = mpsc::channel();
    let ending_thread = thread::spawn(move || {
        let mut handled = false;
        let result = transactions.run(false, &mut |q| {
            handled = ending.run(q, &build, at)?;
            Ok(())
        });
        done_tx.send((result, handled)).unwrap();
    });
    let deadline = Instant::now() + Duration::from_secs(10);
    let mut early = None;
    loop {
        if let Ok(done) = done_rx.try_recv() {
            early = Some(done);
            break;
        }
        let blocked = diesel::sql_query(
            "SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))",
        )
        .bind::<diesel::sql_types::Integer, _>(completion_pid)
        .execute(&mut observer)
        .unwrap();
        if blocked > 0 {
            break;
        }
        assert!(
            Instant::now() < deadline,
            "{ending:?} must wait on completion or skip its lock"
        );
        thread::sleep(Duration::from_millis(5));
    }
    locks::release(&mut gate);
    let completed = completing.join().unwrap();
    ending_thread.join().unwrap();
    let (ended, handled) =
        early.unwrap_or_else(|| done_rx.recv_timeout(Duration::from_secs(10)).unwrap());
    assert!(
        completed.is_ok(),
        "{ending:?}: completion failed: {completed:?}"
    );
    assert!(ended.is_ok(), "{ending:?}: ending failed: {ended:?}");
    if !handled {
        assert!(matches!(ending, Ending::Recover));
        f.transactions
            .run(false, &mut |q| {
                assert!(ending.run(q, &upload.build, at)?);
                Ok(())
            })
            .unwrap();
    }
    f.queries(&mut |q| {
        let build = q.build_by_id(upload.build.id).unwrap().unwrap();
        assert_eq!(build.publication_id, Some(id));
        assert_eq!(
            build.state,
            if matches!(ending, Ending::Cancel | Ending::Supersede) {
                BuildState::Running
            } else {
                BuildState::Published
            }
        );
        assert!(
            q.build_grant(&upload.grant.token_digest)
                .unwrap()
                .unwrap()
                .consumed_at
                .is_some()
        );
        assert_eq!(
            q.publication(id).unwrap().unwrap().state,
            PublicationState::Ready
        );
        assert_eq!(q.publication_files(id).unwrap().len(), 1);
        assert_eq!(
            q.blob(f.project.id, &upload.blob.key.hash)
                .unwrap()
                .unwrap()
                .ref_count,
            1
        );
        let events = q
            .pending_publication_events(at, 100, Some(f.project.id))
            .unwrap();
        assert_eq!(
            events.iter().map(|row| row.event.kind).collect::<Vec<_>>(),
            [EventKind::Ready]
        );
    });
    assert!(
        publication_screen_views::table
            .count()
            .get_result::<i64>(&mut observer)
            .unwrap()
            > 0
    );
}

fn ending_first(ending: Ending) {
    let Some(upload) = Upload::create() else {
        return;
    };
    let f = &upload.fixture;
    let mut observer = f.connection();
    let mut completing = None;
    f.transactions
        .run(false, &mut |q| {
            assert!(ending.run(q, &upload.build, upload.attempt.lease_expires_at)?);
            let ingest = upload.ingest.clone();
            let authorization = upload.authorization.clone();
            let id = upload.publication.id;
            completing = Some(thread::spawn(move || ingest.complete(authorization, id)));
            let completion_pid = locks::waiting_writer(&mut observer);
            locks::wait_for_lock(&mut observer, completion_pid);
            Ok(())
        })
        .unwrap();
    let completed = completing.unwrap().join().unwrap();
    assert!(
        matches!(completed, Err(Error::Unauthorized | Error::Expired)),
        "{ending:?}: {completed:?}"
    );
    f.queries(&mut |q| {
        let build = q.build_by_id(upload.build.id).unwrap().unwrap();
        assert_eq!(
            build.state,
            match ending {
                Ending::Cancel => BuildState::Cancelled,
                Ending::Supersede => BuildState::Superseded,
                Ending::Finalize => BuildState::Failed,
                _ => BuildState::Queued,
            }
        );
        assert!(build.publication_id.is_none());
        assert!(
            q.build_grant(&upload.grant.token_digest)
                .unwrap()
                .unwrap()
                .consumed_at
                .is_none()
        );
        assert_eq!(
            q.publication(upload.publication.id).unwrap().unwrap().state,
            PublicationState::Failed
        );
        assert!(
            q.publication_files(upload.publication.id)
                .unwrap()
                .is_empty()
        );
        assert_eq!(
            q.blob(f.project.id, &upload.blob.key.hash)
                .unwrap()
                .unwrap()
                .ref_count,
            0
        );
        let events = q
            .pending_publication_events(upload.attempt.lease_expires_at, 100, Some(f.project.id))
            .unwrap();
        assert_eq!(
            events.iter().map(|row| row.event.kind).collect::<Vec<_>>(),
            [EventKind::Failed]
        );
    });
    assert_eq!(
        publication_screen_views::table
            .count()
            .get_result::<i64>(&mut observer)
            .unwrap(),
        0
    );
}

#[test]
fn completion_before_cancellation() {
    completion_first(Ending::Cancel);
}
#[test]
fn completion_before_supersession() {
    completion_first(Ending::Supersede);
}
#[test]
fn completion_before_finalization() {
    completion_first(Ending::Finalize);
}
#[test]
fn completion_before_infrastructure_requeue() {
    completion_first(Ending::Requeue);
}
#[test]
fn completion_before_lease_recovery() {
    completion_first(Ending::Recover);
}
#[test]
fn cancellation_before_completion() {
    ending_first(Ending::Cancel);
}
#[test]
fn supersession_before_completion() {
    ending_first(Ending::Supersede);
}
#[test]
fn finalization_before_completion() {
    ending_first(Ending::Finalize);
}
#[test]
fn infrastructure_requeue_before_completion() {
    ending_first(Ending::Requeue);
}
#[test]
fn lease_recovery_before_completion() {
    ending_first(Ending::Recover);
}
