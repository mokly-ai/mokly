//! Pure build and bounded log projections from authorized store data.

use mkc_domain::values::Role;
use mkc_publications::build_log_text::normalize;
use mkc_store_interface::build_history::{BuildSummary, ViewerBuild};
use mkc_store_interface::build_log::BuildLogWindow;
use mkc_store_interface::build_state::BuildState;

use crate::viewer::views::PublicationPullRequest;

use super::views;

pub(crate) fn summary(row: BuildSummary) -> views::BuildSummary {
    views::BuildSummary {
        id: row.id,
        state: row.state.into(),
        created_at: row.created_at,
        head_sha: row.head_sha,
    }
}

pub(super) fn build(row: ViewerBuild, role: Option<Role>) -> views::Build {
    let value = row.build;
    views::Build {
        can_cancel: role.is_some_and(|role| role >= Role::Member)
            && matches!(value.state, BuildState::Queued | BuildState::Running)
            && value.publication_id.is_none(),
        id: value.id,
        project_id: value.project_id,
        state: value.state.into(),
        trigger: value.trigger.into(),
        branch: value.branch,
        head_sha: value.head_sha,
        pull_request: row.pull_request.map(|pull| PublicationPullRequest {
            number: pull.number,
            title: pull.title,
            author: pull.author,
            url: format!(
                "https://github.com/{}/pull/{}",
                pull.repository, pull.number
            ),
        }),
        base_ref: value.base_ref,
        step: value.step.into(),
        created_at: value.created_at,
        started_at: value.started_at,
        finished_at: value.finished_at,
        attempt: value.attempt,
        failure: value.failure_cause.map(|cause| views::Failure {
            step: value.step.into(),
            cause: cause.into(),
            exit_code: value.exit_code,
        }),
        publication_id: value.publication_id,
        superseded_by: value.superseded_by,
    }
}

pub(super) fn log(window: BuildLogWindow) -> views::Log {
    let mut chunks = Vec::new();
    let mut bytes = 0;
    let mut next_after = window.next_after;
    let mut complete = window.complete;
    for chunk in window.chunks {
        let text = normalize(&chunk.bytes);
        if !chunks.is_empty() && bytes + text.len() > 262_144 {
            complete = false;
            break;
        }
        bytes += text.len();
        next_after = chunk.sequence;
        chunks.push(views::LogChunk {
            sequence: chunk.sequence,
            attempt: chunk.attempt,
            step: chunk.step.into(),
            stream: chunk.stream.into(),
            text,
        });
    }
    views::Log {
        chunks,
        next_after,
        complete,
        elision: (window.elided_bytes > 0).then_some(views::Elision {
            after_sequence: window.head_sequence,
            bytes: window.elided_bytes,
        }),
    }
}

#[cfg(test)]
#[path = "_tests_/projection_tests.rs"]
mod tests;
