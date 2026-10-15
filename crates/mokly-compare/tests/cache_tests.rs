//! Real lock leases, byte bounds, LRU eviction, repair and concurrent reuse.

use std::fs;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::thread;

use mokly_compare::cache_types::{Cache, Kind};
use mokly_compare::error::Error;

use support::{Files, cache};

#[expect(
    dead_code,
    reason = "The support module also serves dependency integration tests."
)]
mod support;

#[test]
fn cache_reuses_entries_touches_lru_and_can_be_deleted() {
    let temporary = tempfile::tempdir().unwrap();
    let cache = cache(temporary.path().canonicalize().unwrap().join("cache"), 2064);
    let builder = Files::new();
    let a = "a".repeat(40);
    let b = "b".repeat(40);
    let c = "c".repeat(40);
    {
        let _lease = cache.get(Kind::Sources, &a, &builder).unwrap();
    }
    {
        let _lease = cache.get(Kind::Sources, &b, &builder).unwrap();
    }
    {
        let _lease = cache.get(Kind::Sources, &a, &builder).unwrap();
    }
    {
        let _lease = cache.get(Kind::Sources, &c, &builder).unwrap();
    }
    assert_eq!(builder.calls.load(Ordering::SeqCst), 3);
    let entries = cache.root.join("sources/entries");
    assert!(entries.join(&a).exists());
    assert!(!entries.join(&b).exists());
    assert!(entries.join(&c).exists());
    fs::remove_dir_all(&cache.root).unwrap();
    let lease = cache.get(Kind::Sources, &a, &builder).unwrap();
    assert_eq!(fs::read(lease.directory.join("file")).unwrap(), b"content");
    assert_eq!(builder.calls.load(Ordering::SeqCst), 4);
}

#[test]
fn active_lease_prevents_eviction_and_failure_leaves_no_partial_entry() {
    let temporary = tempfile::tempdir().unwrap();
    let cache = cache(temporary.path().canonicalize().unwrap().join("cache"), 1032);
    let builder = Files::new();
    let first = cache.get(Kind::Sources, &"a".repeat(40), &builder).unwrap();
    assert!(matches!(
        cache.get(Kind::Sources, &"b".repeat(40), &builder),
        Err(Error::CacheLimit { .. })
    ));
    assert!(first.directory.join("file").exists());
    assert!(
        !cache
            .root
            .join("sources/staging")
            .join("b".repeat(40))
            .exists()
    );
    assert!(
        !cache
            .root
            .join("sources/entries")
            .join("b".repeat(40))
            .exists()
    );
}

#[test]
fn corrupt_and_incomplete_receipts_are_rebuilt() {
    let temporary = tempfile::tempdir().unwrap();
    let cache = cache(
        temporary.path().canonicalize().unwrap().join("cache"),
        10000,
    );
    let builder = Files::new();
    let key = "a".repeat(40);
    {
        let _lease = cache.get(Kind::Sources, &key, &builder).unwrap();
    }
    let entry = cache.root.join("sources/entries").join(&key);
    fs::write(entry.join("receipt.json"), b"broken").unwrap();
    {
        let _lease = cache.get(Kind::Sources, &key, &builder).unwrap();
    }
    fs::write(entry.join("data/file"), b"altered").unwrap();
    {
        let _lease = cache.get(Kind::Sources, &key, &builder).unwrap();
    }
    fs::remove_dir_all(entry.join("data")).unwrap();
    {
        let _lease = cache.get(Kind::Sources, &key, &builder).unwrap();
    }
    assert_eq!(builder.calls.load(Ordering::SeqCst), 4);
}

#[test]
fn simultaneous_callers_build_one_entry() {
    let temporary = tempfile::tempdir().unwrap();
    let cache = Arc::new(cache(
        temporary.path().canonicalize().unwrap().join("cache"),
        10000,
    ));
    let builder = Arc::new(Files::new());
    let key = "a".repeat(40);
    let first = cache.get(Kind::Sources, &key, builder.as_ref()).unwrap();
    let other_cache = Arc::clone(&cache);
    let other_builder = Arc::clone(&builder);
    let (sent, received) = std::sync::mpsc::channel();
    let pending = thread::spawn(move || {
        sent.send(()).unwrap();
        other_cache
            .get(Kind::Sources, &key, other_builder.as_ref())
            .unwrap()
    });
    received.recv().unwrap();
    std::mem::drop(first);
    let second = pending.join().unwrap();
    assert_eq!(fs::read(second.directory.join("file")).unwrap(), b"content");
    assert_eq!(builder.calls.load(Ordering::SeqCst), 1);
}

#[cfg(unix)]
#[test]
fn cache_symlinks_never_write_into_the_repository() {
    let temporary = tempfile::tempdir().unwrap();
    let outside = temporary.path().join("repository");
    fs::create_dir(&outside).unwrap();
    let root = temporary.path().join("cache");
    std::os::unix::fs::symlink(&outside, &root).unwrap();
    let cache = cache(root, 10000);
    assert!(matches!(
        cache.get(Kind::Sources, &"a".repeat(40), &Files::new()),
        Err(Error::UnsafeCache { .. })
    ));
    assert_eq!(fs::read_dir(outside).unwrap().count(), 0);
}

#[test]
fn cache_process_probe() {
    let Some(root) = std::env::var_os("MOKLY_TEST_CACHE_PROCESS") else {
        return;
    };
    let cache = cache(root.into(), 1032);
    let _lease = cache
        .get(Kind::Sources, &"a".repeat(40), &Files::new())
        .unwrap();
    println!("cache-lease-ready");
    std::io::Write::flush(&mut std::io::stdout()).unwrap();
    let mut byte = [0];
    std::io::Read::read_exact(&mut std::io::stdin(), &mut byte).unwrap();
}

#[test]
fn another_process_holds_a_lease_against_eviction() {
    let temporary = tempfile::tempdir().unwrap();
    let root = temporary.path().canonicalize().unwrap().join("cache");
    let mut child = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "cache_process_probe", "--nocapture"])
        .env("MOKLY_TEST_CACHE_PROCESS", &root)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    let mut output = std::io::BufReader::new(child.stdout.take().unwrap());
    loop {
        let mut line = String::new();
        assert!(
            std::io::BufRead::read_line(&mut output, &mut line).unwrap() > 0,
            "cache child exited before readiness"
        );
        if line.contains("cache-lease-ready") {
            break;
        }
    }
    let cache = cache(root, 1032);
    assert!(matches!(
        cache.get(Kind::Sources, &"b".repeat(40), &Files::new()),
        Err(Error::CacheLimit { .. })
    ));
    std::io::Write::write_all(child.stdin.as_mut().unwrap(), &[1]).unwrap();
    assert!(child.wait().unwrap().success());
    assert!(
        cache
            .get(Kind::Sources, &"b".repeat(40), &Files::new())
            .is_ok()
    );
}
