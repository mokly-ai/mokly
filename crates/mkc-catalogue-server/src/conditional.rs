//! Weak comparison for public `If-None-Match` requests.

pub(crate) fn matches(value: &str, expected: &str) -> bool {
    let bytes = value.as_bytes();
    let mut cursor = skip_ows(bytes, 0);
    if bytes.get(cursor) == Some(&b'*') {
        cursor = skip_ows(bytes, cursor + 1);
        return cursor == bytes.len();
    }

    let mut matched = false;
    let mut parsed = false;
    while cursor < bytes.len() {
        parsed = true;
        if bytes.get(cursor..cursor + 2) == Some(b"W/") {
            cursor += 2;
        }
        if bytes.get(cursor) != Some(&b'\"') {
            return false;
        }
        cursor += 1;
        let start = cursor;
        while let Some(byte) = bytes.get(cursor) {
            if *byte == b'\"' {
                break;
            }
            if !valid_opaque_byte(*byte) {
                return false;
            }
            cursor += 1;
        }
        if bytes.get(cursor) != Some(&b'\"') {
            return false;
        }
        matched |= bytes.get(start..cursor) == Some(expected.as_bytes());
        cursor = skip_ows(bytes, cursor + 1);
        if cursor == bytes.len() {
            return matched;
        }
        if bytes.get(cursor) != Some(&b',') {
            return false;
        }
        cursor = skip_ows(bytes, cursor + 1);
        if cursor == bytes.len() {
            return false;
        }
    }
    parsed && matched
}

fn skip_ows(bytes: &[u8], mut cursor: usize) -> usize {
    while matches!(bytes.get(cursor), Some(b' ' | b'\t')) {
        cursor += 1;
    }
    cursor
}

fn valid_opaque_byte(byte: u8) -> bool {
    byte == 0x21 || (0x23..=0x7e).contains(&byte) || byte >= 0x80
}

#[cfg(test)]
#[path = "_tests_/conditional_tests.rs"]
mod tests;
