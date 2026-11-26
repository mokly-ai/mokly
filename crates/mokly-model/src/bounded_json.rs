//! JSON decoding for records with nested wire prop tuples.

use serde::de::DeserializeOwned;

const MAX_JSON_DEPTH: usize = 256;

/// Decode JSON with room for the tags and field pairs around bounded prop data.
pub fn from_slice<T: DeserializeOwned>(bytes: &[u8]) -> serde_json::Result<T> {
    serde_json::from_slice(bytes).or_else(|source| {
        if !within_depth(bytes) {
            return Err(source);
        }
        let mut decoder = serde_json::Deserializer::from_slice(bytes);
        decoder.disable_recursion_limit();
        let value = T::deserialize(&mut decoder)?;
        decoder.end()?;
        Ok(value)
    })
}

/// Check JSON nesting before decoding with a larger recursion limit.
pub fn within_depth(bytes: &[u8]) -> bool {
    let mut depth = 0usize;
    let mut quoted = false;
    let mut escaped = false;
    for byte in bytes {
        if quoted {
            if escaped {
                escaped = false;
            } else if *byte == b'\\' {
                escaped = true;
            } else if *byte == b'"' {
                quoted = false;
            }
        } else {
            match byte {
                b'"' => quoted = true,
                b'[' | b'{' => {
                    depth += 1;
                    if depth > MAX_JSON_DEPTH {
                        return false;
                    }
                }
                b']' | b'}' => {
                    let Some(value) = depth.checked_sub(1) else {
                        return false;
                    };
                    depth = value;
                }
                _ => {}
            }
        }
    }
    !quoted && depth == 0
}

#[cfg(test)]
mod tests {
    use super::from_slice;

    #[test]
    fn tagged_json_has_room_for_prop_tuples_under_a_finite_depth_limit() {
        let nested =
            |depth: usize| format!("{}\"[\\\"{{\"{}", "[".repeat(depth), "]".repeat(depth));
        let valid = nested(200);
        let decoded = from_slice::<serde_json::Value>(valid.as_bytes()).unwrap();
        assert_eq!(serde_json::to_string(&decoded).unwrap(), valid);
        let error = from_slice::<serde_json::Value>(nested(257).as_bytes()).unwrap_err();
        assert!(error.to_string().contains("recursion limit exceeded"));
    }
}
