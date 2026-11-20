//! Actual blocked log writers prove allocation and stale-operation fencing.

use std::thread;

use chrono::Duration;
use mkc_store_interface::build_state::BuildState;

use super::log_tests::chunk;
use super::support::{attempt, finish, fixture, pid, rc, wait_for_lock};

#[test]
fn concurrent_log_writers_allocate_different_sequences() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let a = attempt(f.now);
    let mut first = f.connection();
    let mut second = f.connection();
    let mut observer = f.connection();
    let second_pid = pid(&mut second);
    rc(&mut first, |q| {
        q.start_build(b.id, &a).unwrap().unwrap();
    });
    let late = chunk(a.operation_id, b"second".to_vec(), f.now);
    let id = b.id;
    let mut worker = None;
    rc(&mut first, |q| {
        assert!(
            q.append_build_log(id, &chunk(a.operation_id, b"first".to_vec(), f.now))
                .unwrap()
        );
        worker = Some(thread::spawn(move || {
            rc(&mut second, |q| q.append_build_log(id, &late).unwrap())
        }));
        wait_for_lock(&mut observer, second_pid);
    });
    assert!(worker.unwrap().join().unwrap());
    rc(&mut observer, |q| {
        let log = q.build_log(f.project.id, b.id, 0, 100).unwrap().unwrap();
        assert_eq!(
            log.chunks.iter().map(|c| c.sequence).collect::<Vec<_>>(),
            [1, 2]
        );
        assert_eq!(log.chunks[0].bytes, b"first");
        assert_eq!(log.chunks[1].bytes, b"second");
    });
}

#[test]
fn old_attempt_waiting_on_a_new_attempt_is_rejected_without_allocating() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let old = attempt(f.now);
    let new = attempt(f.now + Duration::seconds(60));
    let mut first = f.connection();
    let mut second = f.connection();
    let mut observer = f.connection();
    let second_pid = pid(&mut second);
    rc(&mut first, |q| {
        q.start_build(b.id, &old).unwrap().unwrap();
        q.append_build_log(b.id, &chunk(old.operation_id, b"first".to_vec(), f.now))
            .unwrap();
        q.finish_build(
            b.id,
            Some(old.lease_token),
            &finish(f.now, BuildState::Queued),
        )
        .unwrap();
    });
    let id = b.id;
    let late = chunk(old.operation_id, b"stale".to_vec(), new.now);
    let mut worker = None;
    rc(&mut first, |q| {
        q.start_build(b.id, &new).unwrap().unwrap();
        worker = Some(thread::spawn(move || {
            rc(&mut second, |q| q.append_build_log(id, &late).unwrap())
        }));
        wait_for_lock(&mut observer, second_pid);
    });
    assert!(!worker.unwrap().join().unwrap());
    rc(&mut observer, |q| {
        assert_eq!(
            q.build(f.project.id, b.id).unwrap().unwrap().log_sequence,
            1
        );
        assert!(
            q.append_build_log(b.id, &chunk(new.operation_id, b"new".to_vec(), new.now))
                .unwrap()
        );
        assert_eq!(
            q.build_log(f.project.id, b.id, 1, 100)
                .unwrap()
                .unwrap()
                .chunks[0]
                .sequence,
            2
        );
    });
}

#[test]
fn concurrent_appends_at_the_cap_preserve_head_and_newest_tail_and_count_elision() {
    let Some(f) = fixture() else {
        return;
    };
    let b = f.build("main", 1);
    f.schedule(&b);
    let a = attempt(f.now);
    let mut first = f.connection();
    let mut second = f.connection();
    let mut observer = f.connection();
    let second_pid = pid(&mut second);
    rc(&mut first, |q| {
        q.start_build(b.id, &a).unwrap().unwrap();
        for _ in 0..16 {
            q.append_build_log(b.id, &chunk(a.operation_id, vec![1; 65536], f.now))
                .unwrap();
        }
    });
    let late = chunk(a.operation_id, vec![3; 65536], f.now);
    let id = b.id;
    let mut worker = None;
    rc(&mut first, |q| {
        q.append_build_log(id, &chunk(a.operation_id, vec![2; 65536], f.now))
            .unwrap();
        worker = Some(thread::spawn(move || {
            rc(&mut second, |q| q.append_build_log(id, &late).unwrap())
        }));
        wait_for_lock(&mut observer, second_pid);
    });
    assert!(worker.unwrap().join().unwrap());
    rc(&mut observer, |q| {
        let stored = q.build(f.project.id, id).unwrap().unwrap();
        assert_eq!(
            (
                stored.log_bytes,
                stored.log_sequence,
                stored.log_elided_bytes
            ),
            (1048576, 18, 131072)
        );
        let head = q.build_log(f.project.id, id, 0, 100).unwrap().unwrap();
        assert_eq!(
            head.chunks.iter().map(|c| c.sequence).collect::<Vec<_>>(),
            [1, 2, 3, 4]
        );
        let tail = q.build_log(f.project.id, id, 16, 100).unwrap().unwrap();
        assert_eq!(tail.chunks[0].bytes, vec![2; 65536]);
        assert_eq!(tail.chunks[1].bytes, vec![3; 65536]);
    });
}
