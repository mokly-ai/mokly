//! The base extraction span reaches the timing output with its lease action.

use std::path::Path;
use std::sync::Arc;

use mokly_compare::cache_types::{CacheMock, Kind, Lease};
use mokly_compare::error::Error;
use mokly_compare::extraction::{CachedExtraction, Extraction};
use mokly_git::identity::ObjectId;
use mokly_git::repository::RepositoryMock;
use serde_json::Value;
use unimock::{MockFn, Unimock, matching};

use super::serve_trace_tests::capture;

fn lease() -> Lease {
    Lease {
        directory: "/cache/sources/entries/key/data".into(),
        guard: Box::new(Unimock::new(())),
    }
}

fn spans(records: &[Value]) -> Vec<&Value> {
    records
        .iter()
        .filter(|record| record["stage"] == "review.base-extraction")
        .collect()
}

fn acquire(repository: Unimock, cache: Unimock) -> mokly_compare::error::Result<Lease> {
    let extraction: &dyn Extraction = &CachedExtraction {
        repository: Arc::new(repository),
        cache: Arc::new(cache),
        files: 10,
    };
    extraction.acquire(&ObjectId::parse(&"c".repeat(40)).unwrap())
}

#[test]
fn a_complete_cache_entry_records_reuse() {
    let records = capture(|| {
        let repository = Unimock::new(
            RepositoryMock::source_key
                .next_call(matching!(_))
                .returns(Ok("a".repeat(64))),
        );
        let cache = Unimock::new((
            CacheMock::capacity
                .each_call(matching!(Kind::Sources))
                .returns(1u64 << 20),
            CacheMock::get
                .next_call(matching!(Kind::Sources, _, _))
                .answers(&|_, _, _, _| Ok(lease())),
        ));
        acquire(repository, cache).unwrap();
    });
    let spans = spans(&records);
    assert_eq!(spans.len(), 2);
    assert_eq!(spans[0]["event"], "start");
    assert_eq!(spans[1]["event"], "end");
    assert_eq!(spans[1]["action"], "reuse");
    assert_eq!(spans[1]["status"], "ok");
}

#[test]
fn a_built_cache_entry_records_extract() {
    let records = capture(|| {
        let repository = Unimock::new((
            RepositoryMock::source_key
                .next_call(matching!(_))
                .returns(Ok("a".repeat(64))),
            RepositoryMock::extract
                .next_call(matching!(_, _, _))
                .returns(Ok(())),
        ));
        let cache = Unimock::new((
            CacheMock::capacity
                .each_call(matching!(Kind::Sources))
                .returns(1u64 << 20),
            CacheMock::get
                .next_call(matching!(Kind::Sources, _, _))
                .answers(&|_, _, _, builder| {
                    builder.build(Path::new("/cache/sources/staging/key/data"))?;
                    Ok(lease())
                }),
        ));
        acquire(repository, cache).unwrap();
    });
    let spans = spans(&records);
    assert_eq!(spans.len(), 2);
    assert_eq!(spans[1]["action"], "extract");
    assert_eq!(spans[1]["status"], "ok");
}

#[test]
fn a_failed_extraction_keeps_the_error_status_and_no_action() {
    let records = capture(|| {
        let repository = Unimock::new(
            RepositoryMock::source_key
                .next_call(matching!(_))
                .returns(Ok("a".repeat(64))),
        );
        let cache = Unimock::new((
            CacheMock::capacity
                .each_call(matching!(Kind::Sources))
                .returns(1u64 << 20),
            CacheMock::get
                .next_call(matching!(Kind::Sources, _, _))
                .answers(&|_, _, _, _| Err(Error::Cancelled)),
        ));
        assert!(matches!(acquire(repository, cache), Err(Error::Cancelled)));
    });
    let spans = spans(&records);
    assert_eq!(spans.len(), 2);
    assert_eq!(spans[1]["status"], "error");
    assert!(spans[1].get("action").is_none());
}
