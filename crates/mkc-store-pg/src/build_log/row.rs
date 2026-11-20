//! Private typed byte-chunk and aggregate mappings.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Binary, Integer, Nullable, Text, Timestamptz};
use mkc_store_interface::build_log::BuildLogChunk;
use mkc_store_interface::error::{ErrorResultExt, Result};

#[derive(QueryableByName)]
pub(super) struct ChunkRow {
    #[diesel(sql_type = BigInt)]
    pub(super) sequence: i64,
    #[diesel(sql_type = Integer)]
    attempt: i32,
    #[diesel(sql_type = Nullable<Text>)]
    step: Option<String>,
    #[diesel(sql_type = Text)]
    stream: String,
    #[diesel(sql_type = Binary)]
    bytes: Vec<u8>,
    #[diesel(sql_type = Timestamptz)]
    created_at: DateTime<Utc>,
}

impl ChunkRow {
    pub(super) fn dto(self) -> Result<BuildLogChunk> {
        Ok(BuildLogChunk {
            sequence: self.sequence,
            attempt: self.attempt,
            step: self
                .step
                .map(|v| v.parse().context("decode log step"))
                .transpose()?,
            stream: self.stream.parse().context("decode log stream")?,
            bytes: self.bytes,
            created_at: self.created_at,
        })
    }
}

#[derive(QueryableByName)]
pub(super) struct ByteCount {
    #[diesel(sql_type = BigInt)]
    pub(super) bytes: i64,
}

#[derive(QueryableByName)]
pub(super) struct Sequence {
    #[diesel(sql_type = BigInt)]
    pub(super) log_sequence: i64,
}
