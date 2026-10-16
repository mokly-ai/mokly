//! Resource comparison reads once per side and bounds retained bytes under eviction.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use unimock::{MockFn, Unimock, matching};

use crate::resource_memo::{Memo, ResourceMemo};

#[test]
fn resource_reads_scale_with_routes_and_not_views_while_retention_stays_bounded() {
    let run = |size| {
        let reads = Arc::new(AtomicUsize::new(0));
        let side = |value| {
            let reads = reads.clone();
            Arc::new(Unimock::new(
                RenderGenerationMock::resource_bytes
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, _| {
                        reads.fetch_add(1, Ordering::SeqCst);
                        Ok(Some(vec![value; 1024]))
                    })),
            )) as Arc<dyn RenderGeneration>
        };
        let memo: &dyn ResourceMemo =
            &Memo::new(side(1), side(2), Arc::new(MemoryParsedCss::new(4096)), 4096);
        for _ in 0..10 {
            for index in 0..size {
                let path = format!("static/{index}.css");
                assert!(!memo.equal(&path, &path, &BTreeMap::new()).unwrap());
            }
        }
        let work = memo.work();
        assert_eq!(reads.load(Ordering::SeqCst), work.reads);
        assert_eq!(work.comparisons, size);
        assert!(work.retained_bytes > 0 && work.retained_bytes <= 4096);
        assert_eq!(work.read_bytes, size * 2 * 1024);
        work
    };
    let small = run(8);
    let large = run(32);
    assert_eq!(small.reads, 16);
    assert_eq!(large.reads, 4 * small.reads);
    assert_eq!(large.comparisons, 4 * small.comparisons);
}

#[test]
fn opaque_resources_compare_digest_facts_without_reading_or_retaining_bytes() {
    let side = || {
        Arc::new(Unimock::new(
            RenderGenerationMock::resource_digest
                .next_call(matching!("static/movie.mp4"))
                .returns(Ok(Some("same".into()))),
        )) as Arc<dyn RenderGeneration>
    };
    let memo: &dyn ResourceMemo =
        &Memo::new(side(), side(), Arc::new(MemoryParsedCss::new(4096)), 4096);
    for _ in 0..2 {
        assert!(
            memo.equal("static/movie.mp4", "static/movie.mp4", &BTreeMap::new())
                .unwrap()
        );
    }
    assert_eq!(memo.work().reads, 2);
    assert_eq!(memo.work().read_bytes, 0);
    assert_eq!(memo.work().retained_bytes, 0);
}
