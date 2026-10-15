//! Flush counts stay bounded with bulk synchronization and cache hits.

use std::fs;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_compare::cache_types::{Cache, Kind, Storage};
use mokly_compare::storage::SystemStorage;
use mokly_git::control::Token;
use mokly_platform::flush::FlushMock;
use unimock::{MockFn, Unimock, matching};

#[expect(
    dead_code,
    reason = "Shared host composition also serves install tests."
)]
mod support;

#[test]
fn one_filesystem_flush_replaces_per_file_flushes_where_supported() {
    for count in [1, 4] {
        for bulk in [false, true] {
            let temporary = tempfile::tempdir().unwrap();
            let root = temporary.path().canonicalize().unwrap();
            let data = root.join("data");
            fs::create_dir(&data).unwrap();
            for index in 0..count {
                fs::write(data.join(format!("file{index}")), b"content").unwrap();
            }
            let flush = if bulk {
                Unimock::new(
                    FlushMock::filesystem
                        .next_call(matching!(_))
                        .returns(Ok(true)),
                )
            } else {
                Unimock::new((
                    FlushMock::filesystem
                        .next_call(matching!(_))
                        .returns(Ok(false)),
                    FlushMock::file
                        .each_call(matching!(_))
                        .answers(&|_, _| Ok(()))
                        .n_times(count),
                    FlushMock::directory
                        .each_call(matching!(_))
                        .answers(&|_, _| Ok(()))
                        .n_times(2),
                ))
            };
            let storage: &dyn Storage = &SystemStorage {
                root,
                cancellation: Arc::new(Token::default()),
                flush: Arc::new(flush),
            };
            storage.synchronize(&data).unwrap();
            assert_eq!(storage.size(&data, 1000).unwrap(), count as u64 * 7);
        }
    }
}

#[test]
fn warm_cache_uses_no_durability_operations() {
    let temporary = tempfile::tempdir().unwrap();
    let mut cache = support::cache(
        temporary.path().canonicalize().unwrap().join("cache"),
        10000,
    );
    let key = "a".repeat(40);
    let builder = support::Files::new();
    {
        let _lease = cache.get(Kind::Sources, &key, &builder).unwrap();
    }
    cache.storage = Arc::new(SystemStorage {
        root: cache.root.clone(),
        cancellation: Arc::new(Token::default()),
        flush: Arc::new(Unimock::new(())),
    });
    let lease = cache.get(Kind::Sources, &key, &builder).unwrap();
    assert_eq!(builder.calls.load(Ordering::SeqCst), 1);
    assert_eq!(fs::read(lease.directory.join("file")).unwrap(), b"content");
}
