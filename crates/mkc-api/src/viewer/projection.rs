//! Pure projections of persisted metadata and public comparison artifacts.

use mkc_domain::app_paths;
use mkc_domain::slug::{ProjectSlug, WorkspaceSlug};
use mkc_domain::values::Visibility;
use mkc_mokly_contract::index::CatalogueIndex;
use mkc_mokly_contract::index_values::{ColorScheme, Viewport};
use mkc_publications::locations::Locations;
use mkc_publications::screens;
use mkc_store_interface::publication::{Publication, PublicationState};
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::viewer::{
    PublicationSummary, ViewerBranch, ViewerPublication, ViewerPullRequest,
};
use url::Url;

use crate::builds::projection::summary;
use crate::platform::error::{ErrorResultExt, Result};

use super::input::Selection;
use super::views;

pub(super) fn branch(row: ViewerBranch) -> views::Branch {
    views::Branch {
        name: row.key.name,
        latest_publication_id: row.latest_publication_id,
        newest_publication: row.newest_publication.map(publication_summary),
        newest_build: row.newest_build.map(summary),
        updated_at: row.updated_at,
    }
}

pub(super) fn pull_request(row: ViewerPullRequest) -> views::PullRequest {
    views::PullRequest {
        number: row.key.number,
        title: row.title,
        author: row.author,
        branch: row.branch,
        fork: row.repositories.is_fork(),
        state: if row.merged {
            views::PullState::Merged
        } else if row.key.open {
            views::PullState::Open
        } else {
            views::PullState::Closed
        },
        url: format!(
            "https://github.com/{}/pull/{}",
            row.repository, row.key.number
        ),
        latest_publication_id: row.latest_publication_id,
        newest_publication: row.newest_publication.map(publication_summary),
        newest_build: row.newest_build.map(summary),
    }
}

fn publication_summary(row: PublicationSummary) -> views::PublicationSummary {
    views::PublicationSummary {
        id: row.id,
        build_id: row.build_id,
        state: row.state.into(),
        published_at: row.created_at,
        head_sha: row.head_sha,
    }
}

pub(crate) fn publication(
    context: &ViewerPublication,
    locations: &Locations,
) -> views::Publication {
    let row = &context.publication;
    let (state, counts) = match row.changes {
        Some(Changes::Available(counts)) => (views::ChangesState::Available, Some(counts)),
        Some(Changes::NoComparison) => (views::ChangesState::NoComparison, None),
        None => (views::ChangesState::Unavailable, None),
    };
    views::Publication {
        id: row.id,
        project_id: row.project_id,
        build_id: row.build_id,
        branch: row.metadata.as_ref().map(|m| m.branch.clone()),
        head_sha: row.metadata.as_ref().map(|m| m.head_sha.clone()),
        published_at: row.created_at,
        state: row.state.into(),
        failure_code: row.failure.map(Into::into),
        catalogue_url: (row.state == PublicationState::Ready && row.expired_at.is_none())
            .then(|| locations.catalogue(row.id)),
        review_id: None,
        changes: views::Changes {
            state,
            added: counts.map(|c| c.added),
            changed: counts.map(|c| c.changed),
            removed: counts.map(|c| c.removed),
        },
        can_comment: false,
        pull_request: context
            .pull_request
            .as_ref()
            .map(|pull| views::PublicationPullRequest {
                number: pull.number,
                title: pull.title.clone(),
                author: pull.author.clone(),
                url: format!(
                    "https://github.com/{}/pull/{}",
                    pull.repository, pull.number
                ),
            }),
    }
}

pub(super) fn screens(index: &CatalogueIndex) -> Vec<views::Screen> {
    screens::current(index.current_screens())
        .into_iter()
        .map(|screen| views::Screen {
            path: screen.path,
            title: screen.title.to_owned(),
            views: screen
                .views
                .into_iter()
                .map(|view| views::ScreenView {
                    viewport: view.viewport,
                    color_scheme: view.color_scheme,
                })
                .collect(),
        })
        .collect()
}

pub(super) fn share(
    row: &Publication,
    workspace: &WorkspaceSlug,
    project: &ProjectSlug,
    visibility: Visibility,
    selection: &Selection,
    locations: &Locations,
) -> Result<views::ShareLink> {
    let path = app_paths::publication(workspace, project, row.id);
    let mut url = Url::parse(&app_paths::on_origin(&locations.app_origin, &path))
        .context("construct canonical share URL")?;
    for (key, value) in [
        (
            "catalogueScreen",
            selection.screen.as_ref().map(|path| path.as_str()),
        ),
        ("viewport", selection.viewport.map(viewport)),
        ("scheme", selection.scheme.map(scheme)),
    ] {
        if let Some(value) = value {
            url.query_pairs_mut().append_pair(key, value);
        }
    }
    Ok(views::ShareLink {
        url: url.into(),
        access: match visibility {
            Visibility::Public => views::ShareAccess::Public,
            Visibility::Private => views::ShareAccess::Members,
        },
    })
}

fn viewport(value: Viewport) -> &'static str {
    match value {
        Viewport::Desktop => "desktop",
        Viewport::Mobile => "mobile",
    }
}

fn scheme(value: ColorScheme) -> &'static str {
    match value {
        ColorScheme::Light => "light",
        ColorScheme::Dark => "dark",
    }
}
