//! Each cache build announces its step before it runs, and a complete entry announces nothing.

use std::path::Path;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::cache_types::{Builder, BuilderMock, Cache, CacheMock, Kind, Lease};
use crate::comparison_steps::{Step, StepCache, StepsMock};
use crate::error::Result;

fn lease() -> Lease {
    Lease {
        directory: "/entry".into(),
        guard: Box::new(Unimock::new(())),
    }
}

fn build(builder: &dyn Builder) -> Result<Lease> {
    builder.build(Path::new("/entry/data"))?;
    assert!(!builder.reusable());
    Ok(lease())
}

#[test]
fn builds_announce_their_step_first_and_complete_entries_announce_nothing() {
    let boundaries = Unimock::new((
        CacheMock::get
            .next_call(matching!(Kind::Sources, "source", _))
            .answers(&|_, _, _, builder| build(builder)),
        StepsMock::step
            .next_call(matching!(Step::Extracting))
            .returns(()),
        BuilderMock::build.next_call(matching!(_)).returns(Ok(())),
        BuilderMock::reusable.next_call(matching!()).returns(false),
        CacheMock::get
            .next_call(matching!(Kind::Dependencies, "install", _))
            .answers(&|_, _, _, builder| build(builder)),
        StepsMock::step
            .next_call(matching!(Step::Installing))
            .returns(()),
        BuilderMock::build.next_call(matching!(_)).returns(Ok(())),
        BuilderMock::reusable.next_call(matching!()).returns(false),
        CacheMock::get
            .next_call(matching!(Kind::Sources, "complete", _))
            .answers(&|_, _, _, _| Ok(lease())),
        CacheMock::lease
            .next_call(matching!(Kind::Dependencies, "complete"))
            .answers(&|_, _, _| Ok(Some(lease()))),
    ));
    let cache: &dyn Cache = &StepCache {
        inner: Arc::new(boundaries.clone()),
        steps: Arc::new(boundaries.clone()),
    };
    for (kind, key) in [
        (Kind::Sources, "source"),
        (Kind::Dependencies, "install"),
        (Kind::Sources, "complete"),
    ] {
        cache.get(kind, key, &boundaries).unwrap();
    }
    cache.lease(Kind::Dependencies, "complete").unwrap();
}
