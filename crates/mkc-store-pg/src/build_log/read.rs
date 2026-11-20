//! One-snapshot log windows and completion metadata.

use diesel::prelude::*;
use diesel::sql_types::{BigInt, Bool, Nullable, Uuid as SqlUuid};
use mkc_domain::ids::{BuildId, ProjectId};
use mkc_store_interface::build_log::BuildLogWindow;
use mkc_store_interface::error::{ErrorResultExt, Result};

use crate::queries::PgQueries;

use super::row::ChunkRow;

#[derive(QueryableByName)]
struct WindowRow {
    #[diesel(sql_type = Bool)]
    terminal_complete: bool,
    #[diesel(sql_type = BigInt)]
    log_head_sequence: i64,
    #[diesel(sql_type = BigInt)]
    log_elided_bytes: i64,
    #[diesel(sql_type = Nullable<BigInt>)]
    last_sequence: Option<i64>,
    #[diesel(embed)]
    chunk: Option<ChunkRow>,
}

impl PgQueries<'_> {
    pub(super) fn read_log(
        &mut self,
        project: ProjectId,
        build: BuildId,
        after: i64,
        limit: i64,
    ) -> Result<Option<BuildLogWindow>> {
        let rows = diesel::sql_query(include_str!("read.sql"))
            .bind::<SqlUuid, _>(project.0)
            .bind::<SqlUuid, _>(build.0)
            .bind::<BigInt, _>(after)
            .bind::<BigInt, _>(limit.clamp(1, 100))
            .load::<WindowRow>(self.connection)
            .context("read build log window and completion")?;
        let Some(first) = rows.first() else {
            return Ok(None);
        };
        let mut window = BuildLogWindow {
            chunks: Vec::new(),
            next_after: after,
            complete: first.terminal_complete,
            head_sequence: first.log_head_sequence,
            elided_bytes: first.log_elided_bytes,
        };
        let last_sequence = first.last_sequence;
        for row in rows {
            if let Some(chunk) = row.chunk {
                window.chunks.push(chunk.dto()?);
            }
        }
        if let Some(last) = window.chunks.last() {
            window.next_after = last.sequence;
        }
        window.complete &= last_sequence.is_none_or(|last| last <= window.next_after);
        Ok(Some(window))
    }
}
