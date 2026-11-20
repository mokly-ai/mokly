//! Validated comparison selections retained for database-only sharing.

use mkc_domain::entry_path::EntryPath;
use mkc_domain::ids::PublicationId;

use crate::error::Result;

/// A viewport supported by a published screen.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Viewport {
    /// Desktop layout.
    Desktop,
    /// Mobile layout.
    Mobile,
}

impl Viewport {
    /// Stable persisted spelling.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Desktop => "desktop",
            Self::Mobile => "mobile",
        }
    }
}

/// A color scheme supported by a published screen.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Scheme {
    /// Light appearance.
    Light,
    /// Dark appearance.
    Dark,
}

impl Scheme {
    /// Stable persisted spelling.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Light => "light",
            Self::Dark => "dark",
        }
    }
}

/// One current screen/view pair derived from an accepted comparison.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ScreenView {
    /// Current validated entry path, never an inferred route.
    pub screen_path: EntryPath,
    /// Accepted viewport.
    pub viewport: Viewport,
    /// Accepted color scheme.
    pub scheme: Scheme,
}

/// Optional view filters for an exact entry path.
#[derive(Clone, Debug)]
pub struct Selection {
    /// Selected current entry path.
    pub screen_path: String,
    /// Optional viewport restriction.
    pub viewport: Option<Viewport>,
    /// Optional color scheme restriction.
    pub scheme: Option<Scheme>,
}

/// Queries over the accepted screen selections; callers own authorization.
#[unimock::unimock(api = PublicationScreensMock)]
pub trait PublicationScreens {
    /// Insert selections while validating, in the same transaction as ready.
    fn insert_publication_screen_views(
        &mut self,
        publication: PublicationId,
        views: &[ScreenView],
    ) -> Result<()>;
    /// Test whether one accepted current view satisfies every supplied filter.
    fn publication_screen_selection(
        &mut self,
        publication: PublicationId,
        selection: &Selection,
    ) -> Result<bool>;
}
