//! Ranked outcomes and consumption/cancellation races through real transactions.

use std::thread;

use mkc_store_interface::build_state::{BuildState, UploadOutcome};
use mkc_store_interface::store::Callback;

use super::grant_tests::grant;
use super::support::{attempt, fixture, pid, rc, wait_for_lock};

#[test]
fn concurrent_refusal_and_outage_keep_the_higher_rank() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let a = attempt(f.now);
    let g = grant(b.id, &a);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(b.id, &a)?;
            q.mint_build_grant(&g)?;
            Ok(())
        }))
        .unwrap();
    let mut first = f.connection();
    let mut second = f.connection();
    let mut observer = f.connection();
    let second_pid = pid(&mut second);
    let id = g.id;
    let mut worker = None;
    rc(&mut first, |q| {
        assert!(
            q.record_build_upload_outcome(id, UploadOutcome::Rejected)
                .unwrap()
        );
        worker = Some(thread::spawn(move || {
            rc(&mut second, |q| {
                q.record_build_upload_outcome(id, UploadOutcome::Unavailable)
                    .unwrap()
            })
        }));
        wait_for_lock(&mut observer, second_pid);
    });
    assert!(!worker.unwrap().join().unwrap());
    rc(&mut observer, |q| {
        assert_eq!(
            q.build_grant(&g.token_digest).unwrap().unwrap().outcome,
            Some(UploadOutcome::Rejected)
        );
    });
}

#[test]
fn ready_consumption_wins_before_a_waiting_cancellation() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let a = attempt(f.now);
    let g = grant(b.id, &a);
    let p = f.publication(&b);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(b.id, &a)?;
            q.mint_build_grant(&g)?;
            q.insert_publication(&p)
        }))
        .unwrap();
    let mut first = f.connection();
    let mut second = f.connection();
    let mut observer = f.connection();
    let second_pid = pid(&mut second);
    let (project, id, now) = (f.project.id, b.id, f.now);
    let mut worker = None;
    rc(&mut first, |q| {
        assert!(q.consume_build_grant(g.id, p.id, &|| now).unwrap());
        worker = Some(thread::spawn(move || {
            rc(&mut second, |q| q.cancel_build(project, id, now).unwrap())
        }));
        wait_for_lock(&mut observer, second_pid);
    });
    assert_eq!(
        worker.unwrap().join().unwrap().unwrap().state,
        BuildState::Running
    );
    rc(&mut observer, |q| {
        assert_eq!(
            q.build(project, id).unwrap().unwrap().publication_id,
            Some(p.id)
        );
    });
}

#[test]
fn cancellation_wins_before_a_waiting_ready_consumption() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let a = attempt(f.now);
    let g = grant(b.id, &a);
    let p = f.publication(&b);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(b.id, &a)?;
            q.mint_build_grant(&g)?;
            q.insert_publication(&p)
        }))
        .unwrap();
    let mut first = f.connection();
    let mut second = f.connection();
    let mut observer = f.connection();
    let second_pid = pid(&mut second);
    let (grant_id, publication, now) = (g.id, p.id, f.now);
    let mut worker = None;
    rc(&mut first, |q| {
        assert_eq!(
            q.cancel_build(f.project.id, b.id, now)
                .unwrap()
                .unwrap()
                .state,
            BuildState::Cancelled
        );
        worker = Some(thread::spawn(move || {
            rc(&mut second, |q| {
                q.consume_build_grant(grant_id, publication, &|| now)
                    .unwrap()
            })
        }));
        wait_for_lock(&mut observer, second_pid);
    });
    assert!(!worker.unwrap().join().unwrap());
    rc(&mut observer, |q| {
        assert!(
            q.build_grant(&g.token_digest)
                .unwrap()
                .unwrap()
                .consumed_at
                .is_none()
        );
    });
}
