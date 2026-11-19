//! The reference memo gives the direct scan of each text, reuses the scan of an equal text
//! that it still holds, and keeps its byte bound.

use std::thread;

use crate::reference_cache::{MemoryReferenceCache, ReferenceCache};
use crate::syntax::references;

/// Style texts with and without references. The first eleven pass the reference prefilter,
/// the last three cannot hold a reference.
const CORPUS: [&str; 14] = [
    "x{background:url(a.png)}",
    "x{background:url( 'b c.png' )}",
    "x{background:URL(\"upper.svg\")}",
    "@import 'base.css'; .a{color:red}",
    "@import url(theme.css) screen; .b{}",
    ".a{} @import 'late.css';",
    ".a{background-image:image-set('x.png' 1x, url(y.png) 2x)}",
    "@media screen{.a{background:url(nested.png)}}",
    "/* url(comment.png) */ .a{color:red}",
    ".a{content:'\\201C'}",
    ".furl{color:blue}",
    "",
    "color: red",
    ".a{color:blue!important}",
];

#[test]
fn memo_gives_direct_scans_and_scans_equal_text_once() {
    let cache = MemoryReferenceCache::new(1024 * 1024);
    let mut found = 0;
    for round in 0..2 {
        for text in CORPUS {
            let memo = cache.references(text);
            assert_eq!(
                memo.as_ref(),
                references(text).as_slice(),
                "{round}: {text}"
            );
            found += memo.len();
        }
    }
    assert_eq!(found, 18);
    assert_eq!(cache.stats().scans, 11);
    assert_eq!(cache.stats().hits, 11);
}

#[test]
fn concurrent_lookups_give_direct_scans() {
    let cache = MemoryReferenceCache::new(1024 * 1024);
    let direct: Vec<_> = CORPUS.iter().map(|text| references(text)).collect();
    thread::scope(|scope| {
        for worker in 0..8 {
            let (cache, direct) = (&cache, &direct);
            scope.spawn(move || {
                for round in 0..50 {
                    for offset in 0..CORPUS.len() {
                        let index = (worker + round + offset) % CORPUS.len();
                        assert_eq!(
                            cache.references(CORPUS[index]).as_ref(),
                            direct[index].as_slice(),
                            "{}",
                            CORPUS[index]
                        );
                    }
                }
            });
        }
    });
    let stats = cache.stats();
    assert_eq!(stats.scans + stats.hits, 8 * 50 * 11);
    for text in CORPUS {
        cache.references(text);
    }
    assert_eq!(cache.stats().scans, stats.scans);
    assert_eq!(cache.stats().hits, stats.hits + 11);
}

#[test]
fn memo_keeps_its_byte_bound_and_drops_the_least_recent_scan() {
    let texts: Vec<_> = (0..5)
        .map(|index| format!("x{{background:url(image-{index}.png)}}"))
        .collect();
    let probe = MemoryReferenceCache::new(1024 * 1024);
    probe.references(&texts[0]);
    let charge = probe.stats().bytes;
    let cache = MemoryReferenceCache::new(3 * charge);
    let counts = |cache: &MemoryReferenceCache| (cache.stats().scans, cache.stats().hits);
    for text in &texts[..3] {
        assert_eq!(cache.references(text).as_ref(), references(text).as_slice());
    }
    cache.references(&texts[0]);
    cache.references(&texts[3]);
    assert_eq!(cache.stats().bytes, 3 * charge);
    cache.references(&texts[0]);
    assert_eq!(counts(&cache), (4, 2));
    cache.references(&texts[1]);
    assert_eq!(counts(&cache), (5, 2));
    cache.references(&texts[4]);
    cache.references(&texts[0]);
    assert_eq!(counts(&cache), (6, 3));
    assert_eq!(cache.stats().bytes, 3 * charge);
    let small = MemoryReferenceCache::new(charge - 1);
    for _ in 0..2 {
        assert_eq!(
            small.references(&texts[0]).as_ref(),
            references(&texts[0]).as_slice()
        );
    }
    assert_eq!(
        (small.stats().bytes, small.stats().scans, small.stats().hits),
        (0, 2, 0)
    );
}
