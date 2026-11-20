//! Namespace quotas stop prefix amplification before retaining attacker paths.

use crate::error::{Error, Limit};
use crate::limits::{Limits, Quotas};
use crate::paths::Namespace;

#[test]
fn rejects_512_segment_paths_that_fit_the_byte_ceiling() {
    let path = vec!["a"; 512].join("/");
    assert_eq!(path.len(), 1023);
    let error = Namespace::new(Limits::default())
        .insert(&path, false)
        .unwrap_err();
    assert_eq!(error.status_code(), 413);
}

#[test]
fn counts_distinct_prefixes_at_the_inclusive_quota() {
    let mut namespace = Namespace::new(Limits::lowered(Quotas {
        prefixes: 3,
        ..Quotas::default()
    }));
    namespace.insert("a/b", false).unwrap();
    namespace.insert("a/c", false).unwrap();
    assert!(matches!(
        namespace.insert("a/d", false),
        Err(Error::TooLarge {
            limit: Limit::PrefixCount
        })
    ));
    assert_eq!(namespace.prefixes.len(), 3);
}

#[test]
fn raised_quotas_are_clamped_to_the_receiver_ceiling() {
    let mut namespace = Namespace::new(Limits::lowered(Quotas {
        path_segments: usize::MAX,
        path: usize::MAX,
        prefixes: usize::MAX,
        ..Quotas::default()
    }));
    assert!(matches!(
        namespace.insert(&vec!["a"; 65].join("/"), false),
        Err(Error::TooLarge {
            limit: Limit::PathSegments
        })
    ));
    assert!(matches!(
        namespace.insert(&"a".repeat(1025), false),
        Err(Error::TooLarge { limit: Limit::Path })
    ));
    assert!(namespace.prefixes.is_empty());
}
