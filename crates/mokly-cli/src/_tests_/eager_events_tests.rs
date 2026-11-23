//! Adoption replays every event in original order without spending a cache notice early.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_compare::comparison_steps::Step;
use mokly_model::public_metadata::ChangesStatus;
use unimock::{MockFn, Unimock, matching};

use crate::serve_eager_events::{
    OrderedEvents, PreparationEvent, PreparationEvents, PreparationSinkMock,
};
use crate::warning_support::warning;

#[test]
fn eager_events_replay_every_step_status_notice_and_warning_in_order() {
    let events: Arc<dyn PreparationEvents> = Arc::new(OrderedEvents::default());
    let output = Arc::new(Mutex::new(Vec::new()));
    let recorded = output.clone();
    let sink = Arc::new(
        Unimock::new(
            PreparationSinkMock::report
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, event| {
                    recorded.lock().unwrap().push(event.clone());
                    Ok(true)
                })),
        )
        .no_verify_in_drop(),
    );
    events.step(Step::Reading);
    events.opened(Path::new("/cache/base"));
    events.step(Step::Extracting);
    assert!(events.status(ChangesStatus::Preparing).unwrap());
    events.step(Step::Installing);
    events.step(Step::Rendering);
    events.warnings(vec![warning("base")]);
    assert!(events.status(ChangesStatus::Pending).unwrap());
    assert_eq!(*output.lock().unwrap(), Vec::<PreparationEvent>::new());
    assert!(events.adopt(sink).unwrap());
    assert_eq!(
        *output.lock().unwrap(),
        [
            PreparationEvent::Step(Step::Reading),
            PreparationEvent::Cache("/cache/base".into()),
            PreparationEvent::Step(Step::Extracting),
            PreparationEvent::Status(ChangesStatus::Preparing),
            PreparationEvent::Step(Step::Installing),
            PreparationEvent::Step(Step::Rendering),
            PreparationEvent::Warnings(vec![warning("base")]),
            PreparationEvent::Status(ChangesStatus::Pending),
        ]
    );
}

#[test]
fn discarded_eager_notice_does_not_consume_the_commands_announcement() {
    let events: Arc<dyn PreparationEvents> = Arc::new(OrderedEvents::default());
    let announced = Arc::new(AtomicBool::new(false));
    let flag = announced.clone();
    let sink = Arc::new(
        Unimock::new(
            PreparationSinkMock::report
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    flag.store(true, Ordering::SeqCst);
                    Ok(true)
                })),
        )
        .no_verify_in_drop(),
    );
    events.opened(Path::new("/cache/base"));
    events.discard();
    assert!(!events.adopt(sink).unwrap());
    assert!(!announced.load(Ordering::SeqCst));
}
