//! Source cache builds announce extraction before writing, while complete entries are silent.

use std::path::Path;
use std::sync::Arc;

use mokly_git::identity::ObjectId;
use mokly_git::repository::RepositoryMock;
use unimock::{MockFn, Unimock, matching};

use crate::cache_types::{CacheMock, Kind, Lease};
use crate::comparison_steps::{Step, StepsMock};
use crate::extraction::{CachedExtraction, Extraction};

fn lease() -> Lease {
    Lease {
        directory: "/entry/data".into(),
        guard: Box::new(Unimock::new(())),
    }
}

fn extraction(boundaries: &Unimock) -> CachedExtraction {
    CachedExtraction {
        repository: Arc::new(boundaries.clone()),
        cache: Arc::new(boundaries.clone()),
        steps: Arc::new(boundaries.clone()),
        files: 10,
    }
}

#[test]
fn source_build_announces_extraction_before_writing_and_keeps_the_reuse_policy() {
    let commit = ObjectId::parse(&"c".repeat(40)).unwrap();
    let boundaries = Unimock::new((
        CacheMock::capacity
            .some_call(matching!(Kind::Sources))
            .returns(4096u64),
        RepositoryMock::source_key
            .next_call(matching!((actual) if actual.as_str() == "cccccccccccccccccccccccccccccccccccccccc"))
            .returns(Ok("source".into())),
        CacheMock::get
            .next_call(matching!(Kind::Sources, "source", _))
            .answers(&|_, _, _, builder| {
                builder.build(Path::new("/entry/data"))?;
                assert!(!builder.reusable());
                Ok(lease())
            }),
        StepsMock::step
            .next_call(matching!(Step::Extracting))
            .returns(()),
        RepositoryMock::extract
            .next_call(matching!((actual, destination, limits)
                if actual.as_str() == "cccccccccccccccccccccccccccccccccccccccc"
                    && *destination == Path::new("/entry/data")
                    && limits.files == 10 && limits.bytes == 3072))
            .returns(Ok(())),
        RepositoryMock::conversion_warnings
            .next_call(matching!())
            .returns(vec![("bad.txt".into(), "conversion failed".into())]),
    ));
    let result = extraction(&boundaries).acquire(&commit).unwrap();
    assert_eq!(result.directory, Path::new("/entry/data"));
}

#[test]
fn complete_source_entries_and_existing_leases_announce_nothing() {
    let commit = ObjectId::parse(&"c".repeat(40)).unwrap();
    let boundaries = Unimock::new((
        CacheMock::capacity
            .some_call(matching!(Kind::Sources))
            .returns(4096u64),
        RepositoryMock::source_key
            .some_call(matching!((actual) if actual.as_str() == "cccccccccccccccccccccccccccccccccccccccc"))
            .answers(&|_, _| Ok("complete".into()))
            .n_times(2),
        CacheMock::get
            .next_call(matching!(Kind::Sources, "complete", _))
            .answers(&|_, _, _, _| Ok(lease())),
        CacheMock::lease
            .next_call(matching!(Kind::Sources, "complete"))
            .answers(&|_, _, _| Ok(Some(lease()))),
    ));
    let extraction = extraction(&boundaries);
    assert_eq!(
        extraction.acquire(&commit).unwrap().directory,
        Path::new("/entry/data")
    );
    assert_eq!(
        extraction.existing(&commit).unwrap().unwrap().directory,
        Path::new("/entry/data")
    );
}
