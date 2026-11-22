//! Phase mocks retain the optional early extraction assertion at the source boundary.

use std::sync::Arc;

use mokly_compare::cache_types::Lease;
use unimock::{Clause, MockFn, Unimock, matching};

use crate::base_dependencies::{BaseDependenciesMock, DependencySources};

pub(crate) fn sources(existing: bool) -> impl Clause {
    BaseDependenciesMock::sources
        .some_call(matching!(_, _))
        .answers_arc(Arc::new(move |_, _, early| {
            assert_eq!(early.is_some(), existing);
            Ok(DependencySources {
                sources: early.unwrap_or_else(|| {
                    Arc::new(Lease {
                        directory: "/base".into(),
                        guard: Box::new(Unimock::new(())),
                    })
                }),
                base: Default::default(),
                head: Default::default(),
            })
        }))
}
