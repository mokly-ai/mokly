//! Validate canonical screen sharing without opening publication artifacts.

use mkc_mokly_contract::index_values;
use mkc_store_interface::publication::Publication;
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::publication_screens::{Scheme, Selection, Viewport};
use mkc_store_interface::store::Queries;

use crate::platform::error::{Error, ErrorResultExt, Result};

use super::input;

pub(super) trait ShareValidation {
    fn validate(&self, queries: &mut dyn Queries, publication: &Publication) -> Result<()>;
}

impl ShareValidation for input::Selection {
    fn validate(&self, queries: &mut dyn Queries, publication: &Publication) -> Result<()> {
        let Some(screen) = &self.screen else {
            return Ok(());
        };
        if !matches!(publication.changes, Some(Changes::Available(_))) {
            return Err(Error::OperationUnavailable);
        }
        let selection = Selection {
            screen_path: screen.as_str().to_owned(),
            viewport: self.viewport.map(|value| match value {
                index_values::Viewport::Desktop => Viewport::Desktop,
                index_values::Viewport::Mobile => Viewport::Mobile,
            }),
            scheme: self.scheme.map(|value| match value {
                index_values::ColorScheme::Light => Scheme::Light,
                index_values::ColorScheme::Dark => Scheme::Dark,
            }),
        };
        if !queries
            .publication_screen_selection(publication.id, &selection)
            .context("validate canonical share selection")?
        {
            return Err(Error::InvalidInput);
        }
        Ok(())
    }
}
