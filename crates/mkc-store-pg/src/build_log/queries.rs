//! Implementation of bounded build log queries.

use mkc_domain::ids::{BuildId, ProjectId};
use mkc_store_interface::build_log::{BuildLogWindow, BuildLogs, NewBuildLogChunk};
use mkc_store_interface::error::Result;

use crate::queries::PgQueries;

impl BuildLogs for PgQueries<'_> {
    fn append_build_log(&mut self, build: BuildId, chunk: &NewBuildLogChunk) -> Result<bool> {
        self.append_log(build, chunk)
    }

    fn build_log(
        &mut self,
        project: ProjectId,
        build: BuildId,
        after: i64,
        limit: i64,
    ) -> Result<Option<BuildLogWindow>> {
        self.read_log(project, build, after, limit)
    }
}
