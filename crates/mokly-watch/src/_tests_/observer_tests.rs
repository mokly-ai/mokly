//! Inbox operations preserve the latest descriptor and report errors without stopping flow.

use crate::event::{Event, Kind};
use crate::observer::Inbox;

#[test]
fn burst_coalescing_retains_the_last_descriptor_and_every_other_path() {
    let inbox = Inbox::default();
    for kind in [Kind::File, Kind::Directory, Kind::Rename] {
        inbox.send(Ok(Event {
            path: "/repo/file".into(),
            kind,
        }));
    }
    inbox.send(Ok(Event {
        path: "/repo/second".into(),
        kind: Kind::File,
    }));
    let events = inbox.take();
    assert_eq!(events.len(), 2);
    assert_eq!(events[0].as_ref().unwrap().kind, Kind::Rename);
    assert!(inbox.take().is_empty());
}

#[test]
fn an_observer_error_is_reported_once_and_later_events_keep_flowing() {
    let inbox = Inbox::default();
    inbox.send(Err(crate::error::Error::Observer {
        path: "/repo/file".into(),
        source: notify::Error::generic("fixture failure"),
    }));
    inbox.send(Ok(Event {
        path: "/repo/later".into(),
        kind: Kind::File,
    }));
    let events = inbox.take();
    assert_eq!(events.iter().filter(|event| event.is_err()).count(), 1);
    assert_eq!(events.iter().filter(|event| event.is_ok()).count(), 1);
    assert!(inbox.take().is_empty());
    inbox.send(Ok(Event {
        path: "/repo/next".into(),
        kind: Kind::File,
    }));
    assert_eq!(inbox.take().len(), 1);
}
