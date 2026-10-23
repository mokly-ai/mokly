//! Platform-neutral event mapping and explicit overflow recovery.

use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use notify::EventKind;
use notify::event::{CreateKind, ModifyKind, RemoveKind};

use crate::backend::NativeEvents;
use crate::error::Error;
use crate::event::{Event, Kind};
use crate::observer::Inbox;

pub(crate) struct Receiver {
    pub(crate) repository: PathBuf,
    pub(crate) inbox: Arc<Inbox>,
    pub(crate) warned: AtomicBool,
}

impl NativeEvents for Receiver {
    fn send(&self, event: notify::Result<notify::Event>) {
        let event = match event {
            Ok(event) => event,
            Err(source) => {
                self.inbox.send(Err(Error::Observer { source }));
                return;
            }
        };
        if matches!(event.kind, EventKind::Access(_)) {
            return;
        }
        if event.need_rescan() || event.paths.is_empty() {
            self.inbox.send(Ok(Event {
                path: self.repository.clone(),
                kind: Kind::Directory,
            }));
            if !self.warned.swap(true, Ordering::Relaxed) {
                self.inbox.send(Err(Error::Rescan));
            }
            return;
        }
        let Some(kind) = kind(event.kind) else {
            return;
        };
        for path in event.paths {
            self.inbox.send(Ok(Event { path, kind }));
        }
    }
}

pub(crate) fn kind(kind: EventKind) -> Option<Kind> {
    Some(match kind {
        EventKind::Access(_) => return None,
        EventKind::Create(CreateKind::Folder) | EventKind::Remove(RemoveKind::Folder) => {
            Kind::Directory
        }
        EventKind::Create(CreateKind::Any | CreateKind::Other)
        | EventKind::Remove(RemoveKind::Any | RemoveKind::Other)
        | EventKind::Modify(ModifyKind::Name(_) | ModifyKind::Other)
        | EventKind::Any
        | EventKind::Other => Kind::Rename,
        EventKind::Create(CreateKind::File) | EventKind::Remove(RemoveKind::File) => {
            Kind::Membership
        }
        EventKind::Modify(ModifyKind::Any) => Kind::Modify,
        _ => Kind::File,
    })
}

#[cfg(test)]
#[path = "_tests_/native_events_tests.rs"]
mod native_events_tests;

#[cfg(test)]
#[path = "_tests_/native_platform_events_tests.rs"]
mod native_platform_events_tests;
