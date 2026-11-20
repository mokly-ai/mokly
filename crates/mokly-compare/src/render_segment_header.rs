//! Bounded header serialization borrows fixed positions and uses stack digest text.

use std::io::Cursor;

use serde::ser::{Error, SerializeSeq};
use serde::{Serialize, Serializer};

use crate::render_segment_buffer::Position;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Header<'a> {
    format_version: u8,
    mokly_version: &'a str,
    payload_digest: Hex,
    documents: Positions<'a>,
}

struct Hex([u8; 32]);
impl Serialize for Hex {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut bytes = [0; 64];
        for (index, byte) in self.0.iter().enumerate() {
            bytes[index * 2] = b"0123456789abcdef"[(byte >> 4) as usize];
            bytes[index * 2 + 1] = b"0123456789abcdef"[(byte & 15) as usize];
        }
        let Ok(text) = std::str::from_utf8(&bytes) else {
            return Err(S::Error::custom("invalid digest"));
        };
        serializer.serialize_str(text)
    }
}

#[derive(Serialize)]
struct Record<'a> {
    key: &'a str,
    offset: u64,
    bytes: u64,
    digest: Hex,
}
struct Positions<'a>(&'a [Option<Position>]);
impl Serialize for Positions<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut sequence = serializer.serialize_seq(Some(self.0.len()))?;
        for position in self.0 {
            let Some(position) = position.as_ref() else {
                return Err(S::Error::custom("missing position"));
            };
            let Ok(key) = std::str::from_utf8(&position.key) else {
                return Err(S::Error::custom("invalid key"));
            };
            sequence.serialize_element(&Record {
                key,
                offset: position.offset as u64,
                bytes: position.bytes as u64,
                digest: Hex(position.digest),
            })?;
        }
        sequence.end()
    }
}

pub(crate) fn write(
    bytes: &mut [u8],
    version: &str,
    digest: [u8; 32],
    positions: &[Option<Position>],
) -> Option<usize> {
    let mut writer = Cursor::new(bytes);
    serde_json::to_writer(
        &mut writer,
        &Header {
            format_version: 1,
            mokly_version: version,
            payload_digest: Hex(digest),
            documents: Positions(positions),
        },
    )
    .ok()?;
    Some(writer.position() as usize)
}
