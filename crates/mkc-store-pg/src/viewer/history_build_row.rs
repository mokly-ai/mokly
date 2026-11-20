//! Nullable build mapping for the SQL history union, with disjoint column names.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Bool, Integer, Nullable, Text, Timestamptz, Uuid as SqlUuid};
use mkc_store_interface::build::Build;
use mkc_store_interface::error::Result;
use uuid::Uuid;

use crate::build::row::Row;

#[derive(QueryableByName)]
pub(super) struct HistoryBuildRow {
    #[diesel(sql_type = SqlUuid, column_name = history_build_id)]
    id: Uuid,
    #[diesel(sql_type = SqlUuid, column_name = history_build_project_id)]
    project_id: Uuid,
    #[diesel(sql_type = SqlUuid, column_name = history_build_repository_id)]
    repository_id: Uuid,
    #[diesel(sql_type = Text, column_name = history_build_trigger)]
    trigger: String,
    #[diesel(sql_type = Text, column_name = history_build_branch)]
    branch: String,
    #[diesel(sql_type = Text, column_name = history_build_head_sha)]
    head_sha: String,
    #[diesel(sql_type = Nullable<BigInt>, column_name = history_build_pull_request)]
    pull_request: Option<i64>,
    #[diesel(sql_type = Nullable<Text>, column_name = history_build_base_ref)]
    base_ref: Option<String>,
    #[diesel(sql_type = Text, column_name = history_build_config_path)]
    config_path: String,
    #[diesel(sql_type = Text, column_name = history_build_state)]
    state: String,
    #[diesel(sql_type = Nullable<Text>, column_name = history_build_step)]
    step: Option<String>,
    #[diesel(sql_type = Integer, column_name = history_build_attempt)]
    attempt: i32,
    #[diesel(sql_type = Timestamptz, column_name = history_build_next_attempt_at)]
    next_attempt_at: DateTime<Utc>,
    #[diesel(sql_type = Nullable<SqlUuid>, column_name = history_build_attempt_operation_id)]
    attempt_operation_id: Option<Uuid>,
    #[diesel(sql_type = Nullable<SqlUuid>, column_name = history_build_lease_token)]
    lease_token: Option<Uuid>,
    #[diesel(sql_type = Nullable<Timestamptz>, column_name = history_build_lease_expires_at)]
    lease_expires_at: Option<DateTime<Utc>>,
    #[diesel(sql_type = Nullable<Timestamptz>, column_name = history_build_deadline_at)]
    deadline_at: Option<DateTime<Utc>>,
    #[diesel(sql_type = Nullable<Text>, column_name = history_build_failure_cause)]
    failure_cause: Option<String>,
    #[diesel(sql_type = Nullable<Integer>, column_name = history_build_exit_code)]
    exit_code: Option<i32>,
    #[diesel(sql_type = Nullable<SqlUuid>, column_name = history_build_publication_id)]
    publication_id: Option<Uuid>,
    #[diesel(sql_type = Nullable<SqlUuid>, column_name = history_build_superseded_by)]
    superseded_by: Option<Uuid>,
    #[diesel(sql_type = BigInt, column_name = history_build_log_bytes)]
    log_bytes: i64,
    #[diesel(sql_type = BigInt, column_name = history_build_log_head_sequence)]
    log_head_sequence: i64,
    #[diesel(sql_type = BigInt, column_name = history_build_log_sequence)]
    log_sequence: i64,
    #[diesel(sql_type = BigInt, column_name = history_build_log_elided_bytes)]
    log_elided_bytes: i64,
    #[diesel(sql_type = Bool, column_name = history_build_log_complete)]
    log_complete: bool,
    #[diesel(sql_type = Timestamptz, column_name = history_build_created_at)]
    created_at: DateTime<Utc>,
    #[diesel(sql_type = Nullable<Timestamptz>, column_name = history_build_started_at)]
    started_at: Option<DateTime<Utc>>,
    #[diesel(sql_type = Nullable<Timestamptz>, column_name = history_build_finished_at)]
    finished_at: Option<DateTime<Utc>>,
}

impl HistoryBuildRow {
    pub(super) fn dto(self) -> Result<Build> {
        Row {
            id: self.id,
            project_id: self.project_id,
            repository_id: self.repository_id,
            trigger: self.trigger,
            branch: self.branch,
            head_sha: self.head_sha,
            pull_request: self.pull_request,
            base_ref: self.base_ref,
            config_path: self.config_path,
            state: self.state,
            step: self.step,
            attempt: self.attempt,
            next_attempt_at: self.next_attempt_at,
            attempt_operation_id: self.attempt_operation_id,
            lease_token: self.lease_token,
            lease_expires_at: self.lease_expires_at,
            deadline_at: self.deadline_at,
            failure_cause: self.failure_cause,
            exit_code: self.exit_code,
            publication_id: self.publication_id,
            superseded_by: self.superseded_by,
            log_bytes: self.log_bytes,
            log_head_sequence: self.log_head_sequence,
            log_sequence: self.log_sequence,
            log_elided_bytes: self.log_elided_bytes,
            log_complete: self.log_complete,
            created_at: self.created_at,
            started_at: self.started_at,
            finished_at: self.finished_at,
        }
        .dto()
    }
}
