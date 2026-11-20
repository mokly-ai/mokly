//! Strict operation-specific query validation before store access.

use std::collections::BTreeMap;

use mkc_domain::entry_path::EntryPath;
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_mokly_contract::index_values::{ColorScheme, Viewport};
use mkc_store_interface::viewer::HistoryFilter;

use crate::pagination::parse_limit;
use crate::platform::error::{Error, Result};

use super::cursor::{self, Key, Scope};

#[derive(Clone, Copy, Debug)]
pub(crate) enum Read {
    Branches,
    PullRequests,
    History,
    BuildHistory,
    Publication(PublicationId),
    Screens(PublicationId),
    Share(PublicationId),
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Action {
    pub(crate) project: ProjectId,
    pub(crate) read: Read,
}

#[derive(Clone, Debug, Default)]
pub(crate) struct Selection {
    pub(crate) screen: Option<EntryPath>,
    pub(crate) viewport: Option<Viewport>,
    pub(crate) scheme: Option<ColorScheme>,
}

#[derive(Clone, Debug)]
pub(crate) struct Query {
    pub(crate) scope: Option<Scope>,
    pub(crate) after: Option<Key>,
    pub(crate) limit: usize,
    pub(crate) filter: HistoryFilter,
    pub(crate) selection: Selection,
}

impl Query {
    pub(crate) fn parse(action: Action, query: &str) -> Result<Self> {
        let mut values = BTreeMap::new();
        for (key, value) in url::form_urlencoded::parse(query.as_bytes()) {
            if values
                .insert(key.into_owned(), value.into_owned())
                .is_some()
            {
                return Err(Error::InvalidInput);
            }
        }
        let mut filter = HistoryFilter::default();
        if matches!(action.read, Read::History | Read::BuildHistory) {
            filter.branch = values.remove("branch");
            if filter.branch.as_ref().is_some_and(|v| !valid_branch(v)) {
                return Err(Error::InvalidInput);
            }
            filter.pull_request = match values.remove("pullRequest") {
                Some(value) => match value.parse::<i64>() {
                    Ok(number) if number > 0 => Some(number),
                    _ => return Err(Error::InvalidInput),
                },
                None => None,
            };
        }
        let scope = match action.read {
            Read::Branches => Some(Scope::Branches(action.project)),
            Read::PullRequests => Some(Scope::PullRequests(action.project)),
            Read::History => Some(Scope::History(action.project, filter.clone())),
            Read::BuildHistory => Some(Scope::BuildHistory(action.project, filter.clone())),
            Read::Screens(id) => Some(Scope::Screens(action.project, id)),
            Read::Publication(_) | Read::Share(_) => None,
        };
        let (limit, after) = if let Some(scope) = &scope {
            (
                values
                    .remove("limit")
                    .map(|v| parse_limit(&v))
                    .transpose()?
                    .unwrap_or(50),
                values
                    .remove("cursor")
                    .map(|v| cursor::decode(&v, scope))
                    .transpose()?,
            )
        } else {
            (50, None)
        };
        let mut selection = Selection::default();
        if matches!(action.read, Read::Share(_)) {
            selection.screen = match values.remove("catalogueScreen") {
                Some(value) => match EntryPath::try_from(value) {
                    Ok(path) => Some(path),
                    Err(_) => return Err(Error::InvalidInput),
                },
                None => None,
            };
            selection.viewport = match values.remove("viewport").as_deref() {
                Some("desktop") => Some(Viewport::Desktop),
                Some("mobile") => Some(Viewport::Mobile),
                None => None,
                _ => return Err(Error::InvalidInput),
            };
            selection.scheme = match values.remove("scheme").as_deref() {
                Some("light") => Some(ColorScheme::Light),
                Some("dark") => Some(ColorScheme::Dark),
                None => None,
                _ => return Err(Error::InvalidInput),
            };
        }
        if !values.is_empty() {
            return Err(Error::InvalidInput);
        }
        Ok(Self {
            scope,
            after,
            limit,
            filter,
            selection,
        })
    }

    pub(crate) fn scope(&self) -> Result<&Scope> {
        self.scope.as_ref().ok_or(Error::InvalidInput)
    }
}

fn valid_branch(value: &str) -> bool {
    !value.is_empty() && value.len() <= 2048 && !value.chars().any(char::is_control)
}
