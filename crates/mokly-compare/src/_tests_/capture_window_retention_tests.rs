//! Waiting later routes cannot spend the capacity of an earlier retained view.

use std::sync::atomic::Ordering;

use crate::capture_window_fixture;

use super::Collector;

#[test]
fn a_full_out_of_order_buffer_preserves_the_original_route_order_retention_subset() {
    let full = capture_window_fixture::fixture(false);
    let mut all = Collector::new(usize::MAX);
    full.generation.collect_comparison(&mut all).unwrap();
    let charges: Vec<_> = all
        .views
        .iter()
        .map(|(route, view)| view.charge(route))
        .collect();
    assert_eq!(charges.len(), 4);
    assert!(charges.iter().all(|charge| *charge > 0));
    let bound = all.fixed + charges[1] + charges[2] + charges[3];
    assert!(charges[0] + charges[1] > bound - all.fixed);
    assert!(charges[0] + charges[2] + charges[3] <= bound - all.fixed);
    let fixture = capture_window_fixture::fixture(true);
    let mut collector = Collector::new(bound);
    fixture
        .generation
        .collect_comparison(&mut collector)
        .unwrap();
    assert!(
        fixture.filled.load(Ordering::SeqCst),
        "later completed inputs must fit the exact byte budget while route zero waits"
    );
    assert!(collector.fixed + collector.retained <= bound);
    assert_eq!(
        collector
            .views
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>(),
        ["0/index.html", "2/index.html", "3/index.html"]
    );
    for (route, view) in collector.views {
        assert_eq!(
            view.document.restore().unwrap().bytes,
            all.views[&route].document.restore().unwrap().bytes
        );
    }
}
