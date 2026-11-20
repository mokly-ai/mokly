//! Resolve process membership within its memory-controller mount.

use std::path::{Component, Path, PathBuf};

use crate::cgroup_memory::MemoryFiles;

#[derive(Clone, Copy, Eq, PartialEq)]
pub(crate) enum Controller {
    V1,
    V2,
}

pub(crate) struct Location {
    pub(crate) controller: Controller,
    pub(crate) mount: PathBuf,
    pub(crate) base: PathBuf,
}

pub(crate) fn discover(files: &dyn MemoryFiles) -> Option<Option<Location>> {
    let membership = files.read(Path::new("/proc/self/cgroup")).text()?;
    let mut selected = None;
    for line in membership.lines() {
        let mut fields = line.splitn(3, ':');
        let hierarchy = fields.next()?;
        let controllers = fields.next()?;
        let path = fields.next()?;
        if controllers.split(',').any(|name| name == "memory") {
            selected = Some((Controller::V1, path));
            break;
        }
        if hierarchy == "0" && controllers.is_empty() {
            selected = Some((Controller::V2, path));
        }
    }
    let Some((controller, path)) = selected else {
        return Some(None);
    };
    let path = Path::new(path);
    if !path.is_absolute()
        || path
            .components()
            .any(|component| component == Component::ParentDir)
    {
        return None;
    }
    let mounts = files.read(Path::new("/proc/self/mountinfo")).text()?;
    for line in mounts.lines() {
        let Some((before, after)) = line.split_once(" - ") else {
            continue;
        };
        let after: Vec<_> = after.split_whitespace().collect();
        let matches = match controller {
            Controller::V2 => after.first() == Some(&"cgroup2"),
            Controller::V1 => {
                after.first() == Some(&"cgroup")
                    && after
                        .get(2)
                        .is_some_and(|options| options.split(',').any(|name| name == "memory"))
            }
        };
        if !matches {
            continue;
        }
        let before: Vec<_> = before.split_whitespace().collect();
        let root = decode(before.get(3)?);
        let mount = PathBuf::from(decode(before.get(4)?));
        let Ok(relative) = path.strip_prefix(Path::new(&root)) else {
            continue;
        };
        let base = mount.join(relative);
        return Some(Some(Location {
            controller,
            mount,
            base,
        }));
    }
    None
}

fn decode(value: &str) -> String {
    value
        .replace("\\040", " ")
        .replace("\\011", "\t")
        .replace("\\012", "\n")
        .replace("\\134", "\\")
}
