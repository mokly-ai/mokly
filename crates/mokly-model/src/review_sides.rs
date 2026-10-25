//! Structural move pairs require exact previous paths except for case-only identity.

use crate::review::ReviewEntry;

pub(crate) fn valid(entry: &ReviewEntry) -> bool {
    match (&entry.before, &entry.after, &entry.previous_path) {
        (Some(before), Some(after), Some(previous)) => {
            previous == &before.path && !previous.eq_ignore_ascii_case(&after.path)
        }
        (Some(before), Some(after), None) => before.path.eq_ignore_ascii_case(&after.path),
        (_, _, None) => true,
        _ => false,
    }
}
