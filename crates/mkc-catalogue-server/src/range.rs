//! Pure single-range parsing against an indexed representation length.

use mkc_file_store_interface::stream::ByteRange;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Selection {
    Full,
    Partial(ByteRange),
    Unsatisfiable,
}

pub(crate) fn select(value: &str, total_length: u64) -> Selection {
    if value.bytes().any(|byte| byte.is_ascii_whitespace()) || value.contains(',') {
        return Selection::Full;
    }
    let Some(specification) = value.strip_prefix("bytes=") else {
        return Selection::Full;
    };
    let Some((start, end)) = specification.split_once('-') else {
        return Selection::Full;
    };
    if start.is_empty() {
        return suffix(end, total_length);
    }
    let Some(start) = decimal(start) else {
        return Selection::Full;
    };
    if end.is_empty() {
        return bounded(start, total_length.saturating_sub(1), total_length);
    }
    let Some(end) = decimal(end) else {
        return Selection::Full;
    };
    if start > end {
        return Selection::Unsatisfiable;
    }
    bounded(start, end.min(total_length.saturating_sub(1)), total_length)
}

fn suffix(value: &str, total_length: u64) -> Selection {
    let Some(length) = decimal(value) else {
        return Selection::Full;
    };
    if length == 0 || total_length == 0 {
        return Selection::Unsatisfiable;
    }
    let length = length.min(total_length);
    bounded(total_length - length, total_length - 1, total_length)
}

fn decimal(value: &str) -> Option<u64> {
    (!value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit()))
        .then(|| value.parse().ok())
        .flatten()
}

fn bounded(start: u64, end: u64, total_length: u64) -> Selection {
    if start >= total_length {
        return Selection::Unsatisfiable;
    }
    match ByteRange::new(start, end, total_length) {
        Some(range) => Selection::Partial(range),
        None => Selection::Unsatisfiable,
    }
}

#[cfg(test)]
#[path = "_tests_/range_tests.rs"]
mod tests;
