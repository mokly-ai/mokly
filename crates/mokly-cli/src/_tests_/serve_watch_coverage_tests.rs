//! A candidate with changed roots asks for a second preparation only when uncovered.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_graph::types::RenderGenerationMock;
use mokly_watch::observer::{Observer, ObserverMock};
use unimock::{MockFn, Unimock, matching};

use super::serve_watch_tests::{catalogue, plan, prepared, watch};
use super::{ObserversMock, WatchInputs};

fn generation() -> Unimock {
    Unimock::new((
        RenderGenerationMock::catalogue
            .next_call(matching!())
            .returns(catalogue()),
        RenderGenerationMock::stylesheet_directories
            .next_call(matching!())
            .returns(vec![]),
        RenderGenerationMock::watch_files
            .next_call(matching!())
            .returns(BTreeSet::new()),
    ))
}

#[test]
fn changed_roots_attach_a_new_observer_and_recheck_only_when_uncovered() {
    for covered in [true, false] {
        let active = Arc::new(Unimock::new(
            ObserverMock::covers
                .next_call(
                    matching!((plan) if plan.roots.contains(std::path::Path::new("/repo/next"))),
                )
                .returns(covered),
        ));
        let next: Arc<dyn Observer> = Arc::new(Unimock::new(()));
        let factory = Unimock::new(
            ObserversMock::attach
                .next_call(
                    matching!((plan) if plan.roots.contains(std::path::Path::new("/repo/next"))),
                )
                .returns(Ok(next.clone())),
        );
        let watch = watch(active.clone(), factory);
        let candidate = watch.candidate(&prepared("next", generation())).unwrap();
        assert_eq!(candidate.recheck, !covered);
        assert!(Arc::ptr_eq(&candidate.observer, &next));
        assert!(Arc::ptr_eq(
            &watch.state.lock().unwrap().observer,
            &(active as Arc<dyn Observer>)
        ));
        assert_eq!(watch.plan().roots, plan("specs").roots);
    }
}
