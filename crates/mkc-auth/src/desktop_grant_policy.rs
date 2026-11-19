//! Exact desktop credential forms and base64url S256 challenge encoding.

use sha2::{Digest, Sha256};

/// Accept the exact lowercase hex form of a 256-bit desktop credential.
pub(crate) fn credential(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

/// Admit the documented 43-character base64url challenge form.
pub(crate) fn valid_challenge(value: &str) -> bool {
    value.len() == 43
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

/// Encode the 256-bit digest without padding, retaining its final partial sextet.
pub(crate) fn s256_challenge(verifier: &str) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut output = String::with_capacity(43);
    let mut buffer = 0_u16;
    let mut bits = 0_u8;
    for byte in Sha256::digest(verifier.as_bytes()) {
        buffer = (buffer << 8) | u16::from(byte);
        bits += 8;
        while bits >= 6 {
            bits -= 6;
            output.push(char::from(ALPHABET[usize::from((buffer >> bits) & 63)]));
        }
    }
    output.push(char::from(
        ALPHABET[usize::from((buffer << (6 - bits)) & 63)],
    ));
    output
}
