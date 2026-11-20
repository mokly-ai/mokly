//! Diesel mapping for the immutable, nullable admission observation.

use diesel::prelude::*;
use mkc_db::schema::publication::publications;
use mkc_store_interface::error::{Error, ErrorResultExt, Result};
use mkc_store_interface::publication_changes::{Changes, Counts};

#[derive(AsChangeset)]
#[diesel(table_name = publications, treat_none_as_null = true)]
pub(crate) struct ChangesRow {
    pub(crate) changes_state: Option<String>,
    pub(crate) changes_added: Option<i64>,
    pub(crate) changes_changed: Option<i64>,
    pub(crate) changes_removed: Option<i64>,
}

impl ChangesRow {
    pub(crate) fn record(value: Option<Changes>) -> Result<Self> {
        let (state, counts) = match value {
            None => (None, None),
            Some(Changes::NoComparison) => (Some("no-comparison"), None),
            Some(Changes::Available(counts)) => (Some("available"), Some(counts)),
        };
        Ok(Self {
            changes_state: state.map(str::to_owned),
            changes_added: counts
                .map(|c| i64::try_from(c.added))
                .transpose()
                .context("encode added Changes count")?,
            changes_changed: counts
                .map(|c| i64::try_from(c.changed))
                .transpose()
                .context("encode changed Changes count")?,
            changes_removed: counts
                .map(|c| i64::try_from(c.removed))
                .transpose()
                .context("encode removed Changes count")?,
        })
    }

    pub(crate) fn dto(self) -> Result<Option<Changes>> {
        match (
            self.changes_state.as_deref(),
            self.changes_added,
            self.changes_changed,
            self.changes_removed,
        ) {
            (None, None, None, None) => Ok(None),
            (Some("no-comparison"), None, None, None) => Ok(Some(Changes::NoComparison)),
            (Some("available"), Some(added), Some(changed), Some(removed)) => {
                Ok(Some(Changes::Available(Counts {
                    added: u64::try_from(added).context("decode added Changes count")?,
                    changed: u64::try_from(changed).context("decode changed Changes count")?,
                    removed: u64::try_from(removed).context("decode removed Changes count")?,
                })))
            }
            _ => Err(Error::internal(InvalidObservation)),
        }
    }
}

#[derive(Debug, thiserror::Error)]
#[error("[mkc-store-pg/publication_changes_row] inconsistent Changes observation")]
struct InvalidObservation;
