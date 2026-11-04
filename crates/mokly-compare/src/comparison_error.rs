//! Typed conversion helpers shared by comparison orchestration boundaries.

use crate::error::{Error, Result};

pub(crate) trait CompareResult<T> {
    fn compare(self) -> Result<T>;
}

impl<T> CompareResult<T> for mokly_graph::error::Result<T> {
    #[track_caller]
    fn compare(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(Error::Graph { source }),
        }
    }
}

impl<T> CompareResult<T> for mokly_catalogue::error::Result<T> {
    #[track_caller]
    fn compare(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(Error::Catalogue { source }),
        }
    }
}
