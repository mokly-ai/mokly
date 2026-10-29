//! Event forms emitted by notify backends preserve lookup, filtering, and loss recovery.

use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use notify::event::{CreateKind, Flag, ModifyKind, RemoveKind, RenameMode};
use notify::{Event, EventKind};

use crate::backend::NativeEvents;
use crate::error::Error;
use crate::event::Kind;
use crate::observer::Inbox;

use super::{Receiver, kind};

#[test]
fn unspecified_creation_and_rename_kinds_use_the_node_lookup() {
    for recorded in [
        EventKind::Create(CreateKind::Any),
        EventKind::Remove(RemoveKind::Any),
        EventKind::Create(CreateKind::Other),
        EventKind::Remove(RemoveKind::Other),
        EventKind::Modify(ModifyKind::Name(RenameMode::Any)),
        EventKind::Modify(ModifyKind::Name(RenameMode::From)),
        EventKind::Modify(ModifyKind::Name(RenameMode::To)),
        EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
        EventKind::Other,
    ] {
        assert_eq!(kind(recorded), Some(Kind::Rename));
    }
    assert_eq!(
        kind(EventKind::Create(CreateKind::Folder)),
        Some(Kind::Directory)
    );
    assert_eq!(
        kind(EventKind::Remove(RemoveKind::File)),
        Some(Kind::Membership)
    );
}

#[test]
fn pathless_and_flagged_events_rescan_and_warn_once() {
    let inbox = Arc::new(Inbox::default());
    let receiver: &dyn NativeEvents = &Receiver {
        repository: "/repo".into(),
        inbox: inbox.clone(),
        warned: AtomicBool::new(false),
    };
    receiver.send(Ok(Event::new(EventKind::Other).set_flag(Flag::Rescan)));
    receiver.send(Ok(Event::new(EventKind::Any)));
    receiver.send(Ok(Event::new(EventKind::Other)
        .add_path("/".into())
        .set_flag(Flag::Rescan)));
    let events = inbox.take();
    assert_eq!(events.len(), 2);
    let event = events[0].as_ref().unwrap();
    assert_eq!(event.path.to_str(), Some("/repo"));
    assert_eq!(event.kind, Kind::Directory);
    assert!(matches!(events[1], Err(Error::Rescan)));
}
