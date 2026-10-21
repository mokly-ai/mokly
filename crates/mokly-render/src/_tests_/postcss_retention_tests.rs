//! Dependency IO scales with unique files and retained memory excludes source bytes.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_model::material::digest;
use mokly_sidecar::postcss_evidence::{Evidence, Read};
use mokly_sidecar::results::{Css, Dependency, DependencyKind};
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::postcss_cache::{CssCache, CssRecord};
use crate::postcss_inventory;
use crate::postcss_scan::Scan;

fn measure(size: usize, payload: usize) -> (usize, usize, usize, usize, usize) {
    let reads = Arc::new(AtomicUsize::new(0));
    let projects = Arc::new(AtomicUsize::new(0));
    let walks = Arc::new(AtomicUsize::new(0));
    let counted = reads.clone();
    let projected = projects.clone();
    let walked = walks.clone();
    let tree = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                projected.fetch_add(1, Ordering::Relaxed);
                Ok(Some(Node {
                    identity: path.into(),
                    lexical_kind: FileKind::Directory,
                    kind: FileKind::Directory,
                }))
            })),
        SourceTreeMock::children
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                walked.fetch_add(1, Ordering::Relaxed);
                Ok((0..size)
                    .map(|index| Child {
                        name: format!("input-{index}.txt"),
                        kind: FileKind::File,
                    })
                    .collect())
            })),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                counted.fetch_add(1, Ordering::Relaxed);
                Ok(vec![b'x'; payload])
            })),
    ));
    let mut scan = Scan::default();
    for index in 0..size {
        let inventory = postcss_inventory::collect(
            &tree,
            &mut scan,
            Path::new("/repo"),
            Path::new("/repo"),
            &format!("sheet-{index}.css"),
            vec![Dependency {
                kind: DependencyKind::Directory,
                path: "/repo/inputs".into(),
                plugin: Some("fixture".into()),
                glob: Some("**/*.txt".into()),
            }],
        )
        .unwrap();
        assert_eq!(inventory.inputs.len(), size);
        assert!(
            inventory
                .inputs
                .values()
                .all(|value| value == &digest(&vec![b'x'; payload]))
        );
        assert_eq!(inventory.directories.len(), 1);
    }
    (
        reads.load(Ordering::Relaxed),
        projects.load(Ordering::Relaxed),
        walks.load(Ordering::Relaxed),
        scan.classifications,
        scan.retained_bytes(),
    )
}

#[test]
fn repeated_stylesheet_reports_classify_and_hash_each_generation_input_once() {
    let small = measure(4, 32 * 1024);
    let large = measure(16, 32 * 1024);
    assert!(small.0 > 0 && small.1 > 0 && small.2 > 0 && small.3 > 0);
    assert_eq!(small.0, 4);
    assert_eq!(large.0, 16);
    assert_eq!(small.1, large.1);
    assert_eq!(small.2, large.2);
    assert_eq!(small.3, 4);
    assert_eq!(large.3, small.3 * 4);
    assert!(small.4 > 0 && large.4 <= small.4 * 9 / 2);
    assert_eq!(small.4, measure(4, 1).4);
}

#[test]
fn postcss_cache_charges_results_and_scan_metadata_and_rejects_oversized_retention() {
    let mut cache = CssCache {
        limit: 1024,
        ..Default::default()
    };
    cache.scans.insert("context".into(), Scan::default());
    assert!(cache.retained_bytes() >= size_of::<Scan>() + "context".len());
    cache.insert(
        "large".into(),
        CssRecord {
            result: Css {
                read_evidence: Default::default(),
                unmapped_dependency_directories: None,
                text: "x".repeat(2048),
                dependencies: Vec::new(),
            },
            processed: None,
        },
    );
    assert_eq!(cache.retained_bytes(), 0);
    cache.insert(
        "small".into(),
        CssRecord {
            result: Css {
                read_evidence: Default::default(),
                unmapped_dependency_directories: None,
                text: "a{}".into(),
                dependencies: Vec::new(),
            },
            processed: None,
        },
    );
    assert!(cache.retained_bytes() > 3);
    assert!(cache.retained_bytes() <= cache.limit);
}

#[test]
fn unmapped_directory_metadata_is_included_in_the_cache_byte_bound() {
    let mut cache = CssCache {
        limit: 1024,
        ..Default::default()
    };
    cache.insert(
        "metadata".into(),
        CssRecord {
            result: Css {
                read_evidence: Default::default(),
                text: "a{}".into(),
                dependencies: vec![],
                unmapped_dependency_directories: Some(vec!["x".repeat(4096)]),
            },
            processed: None,
        },
    );
    assert_eq!(cache.retained_bytes(), 0);
}

#[test]
fn observed_read_metadata_is_charged_to_the_existing_cache_bound() {
    let mut cache = CssCache {
        limit: 1024,
        ..Default::default()
    };
    cache.insert(
        "witnesses".into(),
        CssRecord {
            result: Css {
                read_evidence: Evidence {
                    reads: vec![Read::WholeFile {
                        identity: None,
                        path: "x".repeat(4096),
                        digest: "a".repeat(64),
                    }],
                    ..Default::default()
                },
                text: "a{}".into(),
                dependencies: vec![],
                unmapped_dependency_directories: None,
            },
            processed: None,
        },
    );
    assert_eq!(cache.retained_bytes(), 0);
}
