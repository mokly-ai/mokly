//! Exact files outside the active watcher that changed during a preparation replay as events.

use std::collections::BTreeSet;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};

use mokly_graph::types::RenderGenerationMock;
use mokly_watch::event::{Event, Kind};
use mokly_watch::observer::{Observer, ObserverMock};
use unimock::{Clause, MockFn, Unimock, matching};

use super::WatchInputs;
use super::serve_watch_tests::{catalogue, prepared, watch};
use crate::serve_watch_files::ObserversMock;

fn at(seconds: u64) -> SystemTime {
    SystemTime::UNIX_EPOCH + Duration::from_secs(1_000_000 + seconds)
}

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

/// `src/new.ts` is the one exact target in a directory that the observer does not watch.
fn observes() -> impl Clause {
    ObserverMock::observes
        .each_call(matching!(_))
        .answers(&|_, directory| directory != Path::new("/repo/src"))
}

/// The preparation starts at `started`, and the check reads the clock at `checked`.
fn clock(started: SystemTime, checked: SystemTime) -> impl Clause {
    (
        ObserversMock::now.next_call(matching!()).returns(started),
        ObserversMock::now.next_call(matching!()).returns(checked),
    )
}

/// Only `src/new.ts` is ever asked for its modification time.
fn modified(time: Option<SystemTime>) -> impl Clause {
    ObserversMock::modified
        .each_call(matching!((path) if *path == Path::new("/repo/src/new.ts")))
        .returns(time)
}

fn replayed(events: Arc<Mutex<Vec<Event>>>) -> impl Clause {
    ObserverMock::replay
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, replay| {
            let mut events = events.lock().unwrap();
            events.extend(replay.into_iter().map(Result::unwrap));
        }))
}

fn changed() -> Event {
    Event {
        path: "/repo/src/new.ts".into(),
        kind: Kind::File,
    }
}

#[test]
fn files_changed_from_the_margin_before_the_start_until_now_replay_once() {
    for (time, replays) in [
        (Some(at(105)), true),
        (Some(at(99)), true),
        (Some(at(97)), false),
        (Some(at(111)), false),
        (None, false),
    ] {
        let events = Arc::new(Mutex::new(Vec::new()));
        let replace = ObserverMock::replace
            .next_call(matching!(_))
            .returns(Ok(()));
        let observer = Arc::new(if replays {
            Unimock::new((observes(), replace, replayed(events.clone())))
        } else {
            Unimock::new((observes(), replace))
        });
        let factory = Unimock::new((clock(at(100), at(110)), modified(time)));
        let watch = watch(observer, factory);
        watch.begin();
        let candidate = watch.candidate(&prepared("specs", generation())).unwrap();
        assert!(!candidate.recheck);
        let expected: Vec<_> = replays.then(changed).into_iter().collect();
        assert_eq!(*events.lock().unwrap(), expected, "{time:?}");
    }
}

#[test]
fn covered_new_roots_replay_into_the_new_observer() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let active = Arc::new(Unimock::new((
        observes(),
        ObserverMock::covers.next_call(matching!(_)).returns(true),
    )));
    let next: Arc<dyn Observer> = Arc::new(Unimock::new(replayed(events.clone())));
    let factory = Unimock::new((
        ObserversMock::now.next_call(matching!()).returns(at(100)),
        ObserversMock::attach
            .next_call(matching!(_))
            .returns(Ok(next.clone())),
        ObserversMock::now.next_call(matching!()).returns(at(110)),
        modified(Some(at(105))),
    ));
    let watch = watch(active, factory);
    watch.begin();
    let candidate = watch.candidate(&prepared("next", generation())).unwrap();
    assert!(!candidate.recheck);
    assert!(Arc::ptr_eq(&candidate.observer, &next));
    assert_eq!(*events.lock().unwrap(), [changed()]);
}

#[test]
fn an_uncovered_candidate_replays_only_after_its_second_preparation() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let active = Arc::new(Unimock::new((
        observes(),
        ObserverMock::covers.next_call(matching!(_)).returns(false),
    )));
    let next: Arc<dyn Observer> = Arc::new(Unimock::new((
        observes(),
        ObserverMock::replace
            .next_call(matching!(_))
            .returns(Ok(())),
        replayed(events.clone()),
    )));
    let factory = Unimock::new((
        ObserversMock::attach
            .next_call(matching!(_))
            .returns(Ok(next.clone())),
        clock(at(120), at(130)),
        modified(Some(at(125))),
    ));
    let watch = watch(active, factory);
    let mut candidate = watch.candidate(&prepared("next", generation())).unwrap();
    assert!(candidate.recheck);
    assert!(events.lock().unwrap().is_empty());
    watch.begin();
    watch
        .recheck(&mut candidate, &prepared("next", generation()))
        .unwrap();
    assert_eq!(*events.lock().unwrap(), [changed()]);
}
