//! Module work is shared by concurrent callers while unrelated modules remain independent.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::postcss_read_inventory::ModuleDigests;

fn node(path: &Path) -> Node {
    Node {
        identity: path.into(),
        lexical_kind: FileKind::File,
        kind: FileKind::File,
    }
}

fn flight(fail_first: bool) {
    let polling = Duration::from_secs(10);
    let (first_started, first_ready) = mpsc::channel();
    let (release_tx, released) = mpsc::channel();
    let first = Arc::new(AtomicUsize::new(0));
    let projects = Arc::new(AtomicUsize::new(0));
    let digests = Arc::new(AtomicUsize::new(0));
    let first_project = first.clone();
    let project_count = projects.clone();
    let digest_count = digests.clone();
    let release_wait = Arc::new(Mutex::new(released));
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                project_count.fetch_add(1, Ordering::SeqCst);
                if first_project.fetch_add(1, Ordering::SeqCst) == 0 {
                    first_started.send(()).unwrap();
                    release_wait
                        .lock()
                        .unwrap()
                        .recv_timeout(polling + polling)
                        .unwrap();
                }
                if fail_first && project_count.load(Ordering::SeqCst) == 1 {
                    Err(SourceError::Changed { path: path.into() })
                } else {
                    Ok(Some(node(path)))
                }
            })),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                digest_count.fetch_add(1, Ordering::SeqCst);
                Ok("late".into())
            })),
    )));
    let memo = Arc::new(ModuleDigests::default());
    let first_memo = memo.clone();
    let first_tree = tree.clone();
    let first_thread = thread::spawn(move || {
        first_memo.late(first_tree.as_ref(), Path::new("/repo"), "module.js")
    });
    first_ready.recv_timeout(polling).unwrap();
    let second_memo = memo.clone();
    let second_tree = tree.clone();
    let second_thread = thread::spawn(move || {
        second_memo.late(second_tree.as_ref(), Path::new("/repo"), "module.js")
    });
    let deadline = Instant::now() + polling;
    loop {
        let waiting = memo
            .known()
            .get("module.js")
            .is_some_and(|cell| Arc::strong_count(cell) >= 3);
        if waiting || projects.load(Ordering::SeqCst) > 1 {
            break;
        }
        assert!(
            Instant::now() < deadline,
            "the second module caller never arrived"
        );
        thread::yield_now();
    }
    release_tx.send(()).unwrap();

    let expected = if fail_first {
        None
    } else {
        Some("late".into())
    };
    assert_eq!(first_thread.join().unwrap(), expected);
    assert_eq!(second_thread.join().unwrap(), expected);
    assert_eq!(projects.load(Ordering::SeqCst), 1);
    assert_eq!(digests.load(Ordering::SeqCst), usize::from(!fail_first));
    assert_eq!(
        memo.late(tree.as_ref(), Path::new("/repo"), "module.js"),
        Some("late".into())
    );
    assert_eq!(
        projects.load(Ordering::SeqCst),
        if fail_first { 2 } else { 1 }
    );
    assert_eq!(digests.load(Ordering::SeqCst), 1);
}

#[test]
fn finding_7_parallel_missing_module_work_uses_one_project_and_digest() {
    flight(false);
}

#[test]
fn finding_7_failed_flight_releases_waiters_and_the_next_lookup_retries() {
    flight(true);
}

#[test]
fn finding_7_another_module_finishes_while_one_module_is_in_flight() {
    let (started, waiting) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                if path.ends_with("first.js") {
                    started.send(()).unwrap();
                    released
                        .lock()
                        .unwrap()
                        .recv_timeout(Duration::from_secs(30))
                        .unwrap();
                }
                Ok(Some(node(path)))
            })),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers(&|_, _| Ok("late".into()))
            .n_times(2),
    )));
    let memo = Arc::new(ModuleDigests::default());
    let first_tree = tree.clone();
    let first_memo = memo.clone();
    let first =
        thread::spawn(move || first_memo.late(first_tree.as_ref(), Path::new("/repo"), "first.js"));
    waiting.recv_timeout(Duration::from_secs(30)).unwrap();
    assert_eq!(
        memo.late(tree.as_ref(), Path::new("/repo"), "second.js"),
        Some("late".into())
    );
    release.send(()).unwrap();
    assert_eq!(first.join().unwrap(), Some("late".into()));
}

#[test]
fn finding_7_panicked_owner_releases_waiters_and_the_next_lookup_retries() {
    let polling = Duration::from_secs(10);
    let (started, owner_ready) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let (returned, waiter_result) = mpsc::channel();
    let released = Mutex::new(released);
    let projects = Arc::new(AtomicUsize::new(0));
    let digests = Arc::new(AtomicUsize::new(0));
    let project_count = projects.clone();
    let digest_count = digests.clone();
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                if project_count.fetch_add(1, Ordering::SeqCst) == 0 {
                    started.send(()).unwrap();
                    released.lock().unwrap().recv_timeout(polling * 3).unwrap();
                    panic!("module project owner panicked");
                }
                Ok(Some(node(path)))
            })),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                digest_count.fetch_add(1, Ordering::SeqCst);
                Ok("late".into())
            })),
    )));
    let memo = Arc::new(ModuleDigests::default());
    let owner_memo = memo.clone();
    let owner_tree = tree.clone();
    let owner = thread::spawn(move || {
        catch_unwind(AssertUnwindSafe(|| {
            owner_memo.late(owner_tree.as_ref(), Path::new("/repo"), "module.js")
        }))
    });
    owner_ready.recv_timeout(polling).unwrap();
    let waiter_memo = memo.clone();
    let waiter_tree = tree.clone();
    let waiter = thread::spawn(move || {
        returned
            .send(waiter_memo.late(waiter_tree.as_ref(), Path::new("/repo"), "module.js"))
            .unwrap();
    });
    let deadline = Instant::now() + polling;
    loop {
        let waiting = memo
            .known()
            .get("module.js")
            .is_some_and(|cell| Arc::strong_count(cell) >= 3);
        if waiting {
            break;
        }
        assert!(Instant::now() < deadline, "the module waiter never arrived");
        thread::yield_now();
    }
    release.send(()).unwrap();
    assert!(owner.join().unwrap().is_err());
    assert_eq!(waiter_result.recv_timeout(polling).unwrap(), None);
    waiter.join().unwrap();
    assert_eq!(projects.load(Ordering::SeqCst), 1);
    assert_eq!(digests.load(Ordering::SeqCst), 0);
    assert_eq!(
        memo.late(tree.as_ref(), Path::new("/repo"), "module.js"),
        Some("late".into())
    );
    assert_eq!(projects.load(Ordering::SeqCst), 2);
    assert_eq!(digests.load(Ordering::SeqCst), 1);
}
