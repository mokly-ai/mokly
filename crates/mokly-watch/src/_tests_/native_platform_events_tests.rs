//! Table of event forms emitted by notify 8.2.0 on Windows, macOS, and Linux.

use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use notify::event::{
    AccessKind, AccessMode, CreateKind, DataChange, MetadataKind, ModifyKind, RemoveKind,
    RenameMode,
};
use notify::{Event, EventKind};

use crate::backend::NativeEvents;
use crate::event::Kind;
use crate::observer::Inbox;

use super::Receiver;

#[test]
fn each_backend_event_form_preserves_its_path_and_action() {
    let recorded = [
        (
            "windows",
            EventKind::Create(CreateKind::Any),
            Some(Kind::Rename),
        ),
        (
            "windows",
            EventKind::Remove(RemoveKind::Any),
            Some(Kind::Rename),
        ),
        (
            "windows",
            EventKind::Modify(ModifyKind::Name(RenameMode::From)),
            Some(Kind::Rename),
        ),
        (
            "windows",
            EventKind::Modify(ModifyKind::Name(RenameMode::To)),
            Some(Kind::Rename),
        ),
        (
            "windows",
            EventKind::Modify(ModifyKind::Any),
            Some(Kind::Modify),
        ),
        (
            "macos",
            EventKind::Create(CreateKind::File),
            Some(Kind::Membership),
        ),
        (
            "macos",
            EventKind::Remove(RemoveKind::File),
            Some(Kind::Membership),
        ),
        (
            "macos",
            EventKind::Create(CreateKind::Folder),
            Some(Kind::Directory),
        ),
        (
            "macos",
            EventKind::Remove(RemoveKind::Folder),
            Some(Kind::Directory),
        ),
        (
            "macos",
            EventKind::Create(CreateKind::Other),
            Some(Kind::Rename),
        ),
        (
            "macos",
            EventKind::Remove(RemoveKind::Other),
            Some(Kind::Rename),
        ),
        (
            "macos",
            EventKind::Create(CreateKind::Any),
            Some(Kind::Rename),
        ),
        (
            "macos",
            EventKind::Remove(RemoveKind::Any),
            Some(Kind::Rename),
        ),
        (
            "macos",
            EventKind::Modify(ModifyKind::Name(RenameMode::From)),
            Some(Kind::Rename),
        ),
        (
            "macos",
            EventKind::Modify(ModifyKind::Name(RenameMode::Any)),
            Some(Kind::Rename),
        ),
        (
            "macos",
            EventKind::Modify(ModifyKind::Data(DataChange::Content)),
            Some(Kind::File),
        ),
        (
            "macos",
            EventKind::Modify(ModifyKind::Metadata(MetadataKind::Any)),
            Some(Kind::File),
        ),
        (
            "macos",
            EventKind::Modify(ModifyKind::Metadata(MetadataKind::Other)),
            Some(Kind::File),
        ),
        (
            "macos",
            EventKind::Modify(ModifyKind::Metadata(MetadataKind::Ownership)),
            Some(Kind::File),
        ),
        (
            "macos",
            EventKind::Modify(ModifyKind::Metadata(MetadataKind::Extended)),
            Some(Kind::File),
        ),
        (
            "linux",
            EventKind::Create(CreateKind::File),
            Some(Kind::Membership),
        ),
        (
            "linux",
            EventKind::Remove(RemoveKind::File),
            Some(Kind::Membership),
        ),
        (
            "linux",
            EventKind::Create(CreateKind::Folder),
            Some(Kind::Directory),
        ),
        (
            "linux",
            EventKind::Remove(RemoveKind::Folder),
            Some(Kind::Directory),
        ),
        (
            "linux",
            EventKind::Create(CreateKind::Other),
            Some(Kind::Rename),
        ),
        (
            "linux",
            EventKind::Remove(RemoveKind::Other),
            Some(Kind::Rename),
        ),
        (
            "linux",
            EventKind::Modify(ModifyKind::Name(RenameMode::From)),
            Some(Kind::Rename),
        ),
        (
            "linux",
            EventKind::Modify(ModifyKind::Name(RenameMode::To)),
            Some(Kind::Rename),
        ),
        (
            "linux",
            EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
            Some(Kind::Rename),
        ),
        (
            "linux",
            EventKind::Modify(ModifyKind::Data(DataChange::Any)),
            Some(Kind::File),
        ),
        (
            "linux",
            EventKind::Modify(ModifyKind::Metadata(MetadataKind::Any)),
            Some(Kind::File),
        ),
        (
            "linux",
            EventKind::Access(AccessKind::Close(AccessMode::Read)),
            None,
        ),
        (
            "linux",
            EventKind::Access(AccessKind::Close(AccessMode::Write)),
            None,
        ),
        (
            "linux",
            EventKind::Access(AccessKind::Open(AccessMode::Any)),
            None,
        ),
    ];
    for (platform, kind, expected) in recorded {
        let inbox = Arc::new(Inbox::default());
        let receiver = Receiver {
            repository: "/repo".into(),
            inbox: inbox.clone(),
            warned: AtomicBool::new(false),
        };
        receiver.send(Ok(Event::new(kind).add_path("/repo/input".into())));
        let events = inbox.take();
        assert_eq!(
            events.len(),
            usize::from(expected.is_some()),
            "{platform}: {kind:?}"
        );
        if let Some(expected) = expected {
            let event = events[0].as_ref().unwrap();
            assert_eq!(event.path.to_str(), Some("/repo/input"));
            assert_eq!(event.kind, expected, "{platform}: {kind:?}");
        }
    }
}
