//! Shared current-screen projection for admission and viewer listing.

use mkc_domain::entry_path::EntryPath;
use mkc_mokly_contract::index_records::{Screen, ViewAxes};
use mkc_mokly_contract::index_values::{ColorScheme, Viewport};

/// Whether a current identity can be selected in a canonical viewer share URL.
pub fn shareable_identity(path: &str) -> bool {
    EntryPath::is_valid(path)
}

/// Current identity and supported views borrowed from a validated index.
pub struct CurrentScreen<'a> {
    /// Current authored entry path.
    pub path: EntryPath,
    /// Current authored title.
    pub title: &'a str,
    /// Views with a current document, desktop before mobile and light before dark.
    pub views: Vec<&'a ViewAxes>,
}

/// Select shareable current screens in path order, independently of Changes membership.
pub fn current(records: &[Screen]) -> Vec<CurrentScreen<'_>> {
    let mut screens: Vec<_> = records
        .iter()
        .filter_map(|row| {
            let path = row.path.parse().ok()?;
            let title = row.title.as_str();
            let mut views: Vec<_> = row.views.iter().collect();
            if views.is_empty() {
                return None;
            }
            views.sort_by_key(|view| {
                (
                    view.viewport == Viewport::Mobile,
                    view.color_scheme == ColorScheme::Dark,
                )
            });
            Some(CurrentScreen { path, title, views })
        })
        .collect();
    screens.sort_by(|a, b| a.path.cmp(&b.path));
    screens
}
