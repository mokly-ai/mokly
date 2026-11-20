//! Populated viewer observations used by every authorization case.

use mkc_domain::pull_request::PullRequestRepositories;
use mkc_store_interface::viewer::{
    BranchKey, PublicationPullRequest, PublicationSummary, PullRequestKey, ViewerBranch,
    ViewerPublication, ViewerPullRequest,
};

use super::support::{PUBLICATION, now, viewer_publication};

pub(super) fn publication() -> ViewerPublication {
    let mut row = viewer_publication(false);
    row.publication.metadata.as_mut().unwrap().pull_request = Some(7);
    row.pull_request = Some(PublicationPullRequest {
        number: 7,
        title: "Publication origin".into(),
        author: Some("octocat".into()),
        repository: "mokly-ai/mokly-cloud".into(),
    });
    row
}

fn summary() -> PublicationSummary {
    let row = publication().publication;
    PublicationSummary {
        build_id: None,
        id: row.id,
        state: row.state,
        created_at: row.created_at,
        head_sha: row.metadata.map(|metadata| metadata.head_sha),
    }
}

pub(super) fn branch() -> ViewerBranch {
    ViewerBranch {
        key: BranchKey {
            is_default: true,
            name: "main".into(),
        },
        latest_publication_id: Some(PUBLICATION),
        updated_at: now(),
        newest_publication: Some(summary()),
        newest_build: None,
    }
}

pub(super) fn pull_request() -> ViewerPullRequest {
    ViewerPullRequest {
        key: PullRequestKey {
            open: true,
            updated_at: now(),
            number: 7,
        },
        title: "Publication origin".into(),
        author: Some("octocat".into()),
        branch: "main".into(),
        merged: false,
        repository: "mokly-ai/mokly-cloud".into(),
        latest_publication_id: Some(PUBLICATION),
        repositories: PullRequestRepositories {
            bound: 100,
            head: Some(100),
            base: Some(100),
        },
        newest_publication: Some(summary()),
        newest_build: None,
    }
}
