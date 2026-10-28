//! Native observer creation, file times, and the files that changed during a preparation.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use mokly_server::error::Result;
use mokly_source_interface::tree::SourceTree;
use mokly_watch::event::{Event, Kind};
use mokly_watch::native::NativeObserver;
use mokly_watch::observer::Observer;
use mokly_watch::plan::Plan;

use crate::serve_watch::watch_result;

/// The kernel stamps writes from a coarse clock, so a change this close before the start
/// still counts.
const MARGIN: Duration = Duration::from_millis(100);
/// File systems that keep whole seconds round a write down by up to this much.
const WHOLE_SECOND_MARGIN: Duration = Duration::from_secs(2);

/// Native observers, the wall clock, and file modification times behind one boundary.
#[cfg_attr(test, unimock::unimock(api = ObserversMock))]
pub(super) trait Observers: Send + Sync {
    /// Attach a native observer for every target of `plan`.
    fn attach(&self, plan: &Plan) -> Result<Arc<dyn Observer>>;
    /// The current wall-clock time, compared with file modification times only.
    fn now(&self) -> SystemTime;
    /// The modification time of a regular file, or `None` for any other path.
    fn modified(&self, path: &Path) -> Option<SystemTime>;
}

pub(super) struct NativeObservers(pub(super) Arc<dyn SourceTree>);
impl Observers for NativeObservers {
    fn attach(&self, plan: &Plan) -> Result<Arc<dyn Observer>> {
        Ok(Arc::new(watch_result(NativeObserver::new(
            self.0.clone(),
            plan,
        ))?))
    }
    fn now(&self) -> SystemTime {
        SystemTime::now()
    }
    fn modified(&self, path: &Path) -> Option<SystemTime> {
        let metadata = fs::metadata(path).ok()?;
        if !metadata.is_file() {
            return None;
        }
        metadata.modified().ok()
    }
}

/// Targets of `plan` other than roots whose directory `active` does not watch.
pub(super) fn unobserved(plan: &Plan, active: &dyn Observer) -> Vec<PathBuf> {
    plan.targets()
        .into_iter()
        .filter(|path| !plan.roots.contains(path))
        .filter(|path| path.parent().is_none_or(|parent| !active.observes(parent)))
        .collect()
}

/// A change event for each regular file among `paths` modified after `started`, up to now.
pub(super) fn changed(
    paths: &[PathBuf],
    started: SystemTime,
    files: &dyn Observers,
) -> Vec<mokly_watch::error::Result<Event>> {
    let now = files.now();
    paths
        .iter()
        .filter(|path| {
            files
                .modified(path)
                .is_some_and(|time| earliest(started, time) <= time && time <= now)
        })
        .map(|path| {
            Ok(Event {
                path: path.clone(),
                kind: Kind::File,
            })
        })
        .collect()
}

/// The earliest time of a change during a preparation that began at `started`. A time
/// with no sub-second part may come from a file system that keeps whole seconds.
fn earliest(started: SystemTime, time: SystemTime) -> SystemTime {
    let whole = time
        .duration_since(SystemTime::UNIX_EPOCH)
        .is_ok_and(|elapsed| elapsed.subsec_nanos() == 0);
    let margin = if whole { WHOLE_SECOND_MARGIN } else { MARGIN };
    started
        .checked_sub(margin)
        .unwrap_or(SystemTime::UNIX_EPOCH)
}
