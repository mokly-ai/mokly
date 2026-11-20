//! Private Diesel mapping of durable build rows.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::build::builds;
use mkc_store_interface::build::Build;
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

#[derive(Queryable, QueryableByName, Selectable)]
#[diesel(table_name = builds)]
pub(crate) struct Row {
    pub(crate) id: Uuid,
    pub(crate) project_id: Uuid,
    pub(crate) repository_id: Uuid,
    pub(crate) trigger: String,
    pub(crate) branch: String,
    pub(crate) head_sha: String,
    pub(crate) pull_request: Option<i64>,
    pub(crate) base_ref: Option<String>,
    pub(crate) config_path: String,
    pub(crate) state: String,
    pub(crate) step: Option<String>,
    pub(crate) attempt: i32,
    pub(crate) next_attempt_at: DateTime<Utc>,
    pub(crate) attempt_operation_id: Option<Uuid>,
    pub(crate) lease_token: Option<Uuid>,
    pub(crate) lease_expires_at: Option<DateTime<Utc>>,
    pub(crate) deadline_at: Option<DateTime<Utc>>,
    pub(crate) failure_cause: Option<String>,
    pub(crate) exit_code: Option<i32>,
    pub(crate) publication_id: Option<Uuid>,
    pub(crate) superseded_by: Option<Uuid>,
    pub(crate) log_bytes: i64,
    pub(crate) log_head_sequence: i64,
    pub(crate) log_sequence: i64,
    pub(crate) log_elided_bytes: i64,
    pub(crate) log_complete: bool,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) started_at: Option<DateTime<Utc>>,
    pub(crate) finished_at: Option<DateTime<Utc>>,
}

impl Row {
    pub(crate) fn dto(self) -> Result<Build> {
        Ok(Build {
            id: self.id.into(),
            project_id: self.project_id.into(),
            repository_id: self.repository_id.into(),
            trigger: self.trigger.parse().context("decode build trigger")?,
            branch: self.branch,
            head_sha: self.head_sha,
            pull_request: self.pull_request,
            base_ref: self.base_ref,
            config_path: self.config_path,
            state: self.state.parse().context("decode build state")?,
            step: self
                .step
                .map(|v| v.parse().context("decode build step"))
                .transpose()?,
            attempt: self.attempt,
            next_attempt_at: self.next_attempt_at,
            attempt_operation_id: self.attempt_operation_id,
            lease_token: self.lease_token,
            lease_expires_at: self.lease_expires_at,
            deadline_at: self.deadline_at,
            failure_cause: self
                .failure_cause
                .map(|v| v.parse().context("decode build failure"))
                .transpose()?,
            exit_code: self.exit_code,
            publication_id: self.publication_id.map(Into::into),
            superseded_by: self.superseded_by.map(Into::into),
            log_bytes: self.log_bytes,
            log_head_sequence: self.log_head_sequence,
            log_sequence: self.log_sequence,
            log_elided_bytes: self.log_elided_bytes,
            log_complete: self.log_complete,
            created_at: self.created_at,
            started_at: self.started_at,
            finished_at: self.finished_at,
        })
    }
}
