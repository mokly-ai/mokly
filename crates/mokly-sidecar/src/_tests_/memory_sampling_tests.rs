//! Host process scans stay constant across a 1:4 render-count comparison.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use unimock::{MockFn, Unimock, matching};

use crate::memory_table::{CanonicalizeMock, RefreshMock};
use crate::memory_tree::Sample;
use crate::process_memory::{Monitor, RESCAN_REQUESTS, ResidentMemory};

#[derive(Default)]
struct Counts {
    full: AtomicUsize,
    partial: AtomicUsize,
    paths: AtomicUsize,
}
fn monitor() -> (Monitor, Arc<Counts>) {
    let counts = Arc::new(Counts::default());
    let refreshed = counts.clone();
    let paths = counts.clone();
    let records = BTreeMap::from([
        (
            1,
            Sample {
                parent: None,
                bytes: 100,
                executable: Some("/alias/node".into()),
                started: 1,
            },
        ),
        (
            2,
            Sample {
                parent: Some(1),
                bytes: 200,
                executable: Some("/real/node".into()),
                started: 2,
            },
        ),
        (
            3,
            Sample {
                parent: Some(1),
                bytes: 400,
                executable: Some("/esbuild".into()),
                started: 3,
            },
        ),
        (
            4,
            Sample {
                parent: None,
                bytes: 800,
                executable: Some("/real/node".into()),
                started: 4,
            },
        ),
    ]);
    let table = Unimock::new((
        RefreshMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, selected| {
                match selected {
                    Some(pids) => {
                        assert_eq!(pids, &[1, 2, 3]);
                        refreshed.partial.fetch_add(1, Ordering::SeqCst);
                    }
                    None => {
                        refreshed.full.fetch_add(1, Ordering::SeqCst);
                    }
                }
                records
                    .iter()
                    .filter(|(pid, _)| selected.is_none_or(|pids| pids.contains(pid)))
                    .map(|(pid, sample)| (*pid, sample.clone()))
                    .collect()
            })),
        CanonicalizeMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                paths.paths.fetch_add(1, Ordering::SeqCst);
                Some(if path == std::path::Path::new("/alias/node") {
                    PathBuf::from("/real/node")
                } else {
                    path.into()
                })
            })),
    ));
    (Monitor::new(1, Box::new(table)), counts)
}

#[test]
fn full_scans_and_executable_reads_do_not_grow_with_eight_to_thirty_two_renders() {
    let run = |renders| {
        let (memory, counts) = monitor();
        assert_eq!(memory.resident_bytes(true).unwrap(), 300);
        for _ in 0..renders {
            assert_eq!(memory.resident_bytes(false).unwrap(), 300);
        }
        (
            counts.full.load(Ordering::SeqCst),
            counts.partial.load(Ordering::SeqCst),
            counts.paths.load(Ordering::SeqCst),
        )
    };
    let small = run(8);
    let large = run(32);
    assert_eq!(small, (2, 8, 3));
    assert_eq!(large.0, small.0);
    assert_eq!(large.2, small.2);
    assert!(small.1 > 0 && large.1 <= small.1 * 4);
}

#[test]
fn full_scans_happen_at_spawn_after_css_and_at_the_request_interval() {
    let (memory, counts) = monitor();
    assert_eq!(counts.full.load(Ordering::SeqCst), 1);
    for _ in 1..RESCAN_REQUESTS {
        memory.resident_bytes(false).unwrap();
    }
    assert_eq!(counts.full.load(Ordering::SeqCst), 1);
    memory.resident_bytes(false).unwrap();
    assert_eq!(counts.full.load(Ordering::SeqCst), 2);
    memory.resident_bytes(true).unwrap();
    assert_eq!(counts.full.load(Ordering::SeqCst), 3);
    assert_eq!(counts.paths.load(Ordering::SeqCst), 3);
}
