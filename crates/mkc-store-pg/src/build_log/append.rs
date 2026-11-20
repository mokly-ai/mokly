//! Atomic sequence allocation and byte-exact retained head with a rolling tail.

use diesel::prelude::*;
use diesel::sql_types::{BigInt, Uuid as SqlUuid};
use mkc_db::schema::build::builds;
use mkc_db::schema::build_output::build_log_chunks;
use mkc_domain::ids::BuildId;
use mkc_store_interface::build_log::NewBuildLogChunk;
use mkc_store_interface::error::{Error, ErrorResultExt, Result};

use crate::build::row::Row;
use crate::queries::PgQueries;

use super::row::{ByteCount, Sequence};

#[derive(Debug, thiserror::Error)]
#[error("[mkc-store-pg/build_log] log chunk must contain 1 through 65536 bytes")]
struct InvalidChunk;

impl PgQueries<'_> {
    pub(super) fn append_log(&mut self, id: BuildId, chunk: &NewBuildLogChunk) -> Result<bool> {
        if chunk.bytes.is_empty() || chunk.bytes.len() > 65_536 {
            return Err(Error::internal(InvalidChunk));
        }
        let row = builds::table
            .find(id.0)
            .filter(builds::attempt_operation_id.eq(chunk.attempt_operation_id))
            .select(Row::as_select())
            .for_update()
            .first::<Row>(self.connection)
            .optional()
            .context("lock log append at its attempt operation")?;
        let Some(row) = row else {
            return Ok(false);
        };
        let head_bytes = diesel::sql_query(
            "SELECT COALESCE(sum(octet_length(bytes)), 0)::bigint AS bytes
            FROM build_log_chunks WHERE build_id = $1 AND sequence <= $2",
        )
        .bind::<SqlUuid, _>(id.0)
        .bind::<BigInt, _>(row.log_head_sequence)
        .get_result::<ByteCount>(self.connection)
        .context("read retained log head size")?
        .bytes;
        let size = i64::try_from(chunk.bytes.len()).context("encode log chunk size")?;
        let split = usize::try_from((262_144 - head_bytes).clamp(0, size))
            .context("encode retained head split")?;
        let mut head_sequence = row.log_head_sequence;
        for (bytes, is_head) in [
            (&chunk.bytes[..split], true),
            (&chunk.bytes[split..], false),
        ] {
            if bytes.is_empty() {
                continue;
            }
            let sequence = diesel::sql_query(
                "UPDATE builds SET log_sequence = log_sequence + 1
                WHERE id = $1 RETURNING log_sequence",
            )
            .bind::<SqlUuid, _>(id.0)
            .get_result::<Sequence>(self.connection)
            .context("allocate permanent log sequence")?
            .log_sequence;
            diesel::insert_into(build_log_chunks::table)
                .values((
                    build_log_chunks::build_id.eq(id.0),
                    build_log_chunks::sequence.eq(sequence),
                    build_log_chunks::attempt.eq(row.attempt),
                    build_log_chunks::step.eq(chunk.step.map(|v| v.as_str())),
                    build_log_chunks::stream.eq(chunk.stream.as_str()),
                    build_log_chunks::bytes.eq(bytes),
                    build_log_chunks::created_at.eq(chunk.created_at),
                ))
                .execute(self.connection)
                .context("append redacted build log bytes")?;
            if is_head {
                head_sequence = sequence;
            }
        }
        let elided = diesel::sql_query(include_str!("elide.sql"))
            .bind::<SqlUuid, _>(id.0)
            .bind::<BigInt, _>(head_sequence)
            .get_result::<ByteCount>(self.connection)
            .context("elide oldest rolling log tail chunks")?
            .bytes;
        diesel::update(builds::table.find(id.0))
            .set((
                builds::log_head_sequence.eq(head_sequence),
                builds::log_bytes.eq(row.log_bytes + size - elided),
                builds::log_elided_bytes.eq(row.log_elided_bytes + elided),
            ))
            .execute(self.connection)
            .context("record bounded log counters")?;
        Ok(true)
    }
}
