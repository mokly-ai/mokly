//! A lower current capacity prevents completion admission without cancelling owners.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;
use std::thread;

use mokly_graph::background::Completion;
use mokly_graph::cache::{Artifact, MemoryCache, RenderCache};
use mokly_graph::key::NodeKey;
use mokly_html::composition::Composed;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::background_capacity::BackgroundCapacityMock;
use crate::background_capacity::FixedCapacity;
use crate::background_stage::Stages;

#[test]
fn completion_admission_reads_capacity_after_shrink_and_preserves_existing_places() {
    let capacity = Arc::new(AtomicUsize::new(2));
    let (sent, reads) = mpsc::channel();
    let mock = Unimock::new(
        BackgroundCapacityMock::capacity
            .each_call(matching!())
            .answers_arc(Arc::new({
                let capacity = capacity.clone();
                move |_| {
                    let count = capacity.load(Ordering::SeqCst);
                    sent.send(count).unwrap();
                    count
                }
            })),
    );
    let bound = Stages::new(Arc::new(mock.clone()));
    let first = bound.view("one");
    let second = bound.view("two");
    first.enter();
    second.enter();
    assert_eq!(reads.recv().unwrap(), 2);
    assert_eq!(reads.recv().unwrap(), 2);
    capacity.store(1, Ordering::SeqCst);
    let third = bound.view("three");
    let (ended, finished) = mpsc::channel();
    thread::scope(|scope| {
        let third = third.clone();
        scope.spawn(move || {
            third.enter();
            ended.send(()).unwrap();
        });
        assert_eq!(reads.recv().unwrap(), 1);
        assert_eq!(*bound.active.lock().unwrap(), 2);
        first.finish();
        assert_eq!(reads.recv().unwrap(), 1);
        assert_eq!(*bound.active.lock().unwrap(), 1);
        second.finish();
        finished.recv().unwrap();
    });
    assert_eq!(*bound.active.lock().unwrap(), 1);
    third.finish();
    assert_eq!(*bound.active.lock().unwrap(), 0);
}

#[test]
fn transient_budget_refuses_without_evicting_cache_and_returns_charge_at_finish() {
    let cache = MemoryCache::new(4096, 0);
    let control = MemoryCache::new(4096, 0);
    let key = NodeKey("held".into());
    let value = Arc::new(Artifact {
        bytes: vec![1; 2000],
        fragment: None,
        content_type: "text/html".into(),
        document: Some(Composed {
            tree: vec![],
            usage: CatalogueUsage::Unavailable,
            warnings: vec![],
            resources: vec![],
            components: vec![],
            links: vec![],
        }),
    });
    cache.insert(key.clone(), value.clone());
    control.insert(key.clone(), value.clone());
    let before = cache.stats();
    let bound = Stages::new(Arc::new(FixedCapacity(2)));
    let first = bound.view("one");
    let second = bound.view("two");
    first.handoff(3 * 1024 * 1024);
    second.handoff(2 * 1024 * 1024);
    assert!(first.handed_off());
    assert!(!second.handed_off());
    assert_eq!(*bound.bytes.lock().unwrap(), 3 * 1024 * 1024);
    assert_eq!(cache.stats(), before);
    assert!(cache.get(&key).is_some());
    assert!(control.get(&key).is_some());
    for index in 0..12 {
        let key = NodeKey(format!("document-{index}"));
        cache.insert(key.clone(), value.clone());
        control.insert(key.clone(), value.clone());
        assert_eq!(cache.stats(), control.stats());
    }
    assert!(cache.stats().evictions > 0);
    first.finish();
    second.finish();
    assert_eq!(*bound.bytes.lock().unwrap(), 0);
    let third = bound.view("three");
    third.handoff(4 * 1024 * 1024);
    assert!(third.handed_off());
    third.finish();
    assert_eq!(*bound.bytes.lock().unwrap(), 0);
}
