//! Finite controller bounds subtract resident charges and credit inactive file cache.

use std::path::Path;

use crate::cgroup_discovery::Controller;
use crate::cgroup_memory::{MemoryFile, MemoryFiles};

pub(crate) fn headroom(
    files: &dyn MemoryFiles,
    path: &Path,
    controller: Controller,
    mount_root: bool,
    ancestor: bool,
) -> Option<Option<u64>> {
    let (bound, current_name, cache_names) = match controller {
        Controller::V2 => {
            let max = files.read(&path.join("memory.max"));
            let high = files.read(&path.join("memory.high"));
            if mount_root && matches!((&max, &high), (MemoryFile::Missing, MemoryFile::Missing)) {
                return Some(None);
            }
            let max = limit(&max.text()?, false)?;
            let high = limit(&high.text()?, false)?;
            (smaller(max, high), "memory.current", &["inactive_file"][..])
        }
        Controller::V1 => (
            limit(
                &files.read(&path.join("memory.limit_in_bytes")).text()?,
                true,
            )?,
            "memory.usage_in_bytes",
            &["total_inactive_file", "inactive_file"][..],
        ),
    };
    let Some(bound) = bound else {
        return Some(None);
    };
    if controller == Controller::V1 && ancestor {
        match files
            .read(&path.join("memory.use_hierarchy"))
            .text()?
            .trim()
        {
            "0" => return Some(None),
            "1" => {}
            _ => return None,
        }
    }
    let current = files
        .read(&path.join(current_name))
        .text()?
        .trim()
        .parse::<u64>()
        .ok()?;
    let stat = files.read(&path.join("memory.stat")).text()?;
    let cache = cache_bytes(&stat, cache_names)?;
    Some(Some(bound.saturating_sub(current.saturating_sub(cache))))
}

fn cache_bytes(stat: &str, names: &[&str]) -> Option<u64> {
    for name in names {
        if let Some(line) = stat
            .lines()
            .find(|line| line.split_whitespace().next() == Some(*name))
        {
            return line.split_whitespace().nth(1)?.parse().ok();
        }
    }
    None
}

fn limit(text: &str, v1: bool) -> Option<Option<u64>> {
    let text = text.trim();
    if text == "max" && !v1 {
        return Some(None);
    }
    let value = text.parse::<u64>().ok()?;
    if v1 && value >= (isize::MAX as u64).saturating_sub(65_535) {
        return Some(None);
    }
    Some(Some(value))
}

fn smaller(first: Option<u64>, second: Option<u64>) -> Option<u64> {
    match (first, second) {
        (Some(first), Some(second)) => Some(first.min(second)),
        _ => first.or(second),
    }
}
