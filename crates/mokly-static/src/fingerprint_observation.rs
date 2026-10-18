//! Stable unreadable markers defer source diagnostics to catalogue discovery.

use mokly_source_interface::error::Result;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum Observation<T> {
    Value(T),
    Unreadable,
}

impl<T: Clone> From<&Result<T>> for Observation<T> {
    fn from(result: &Result<T>) -> Self {
        match result {
            Ok(value) => Self::Value(value.clone()),
            Err(_) => Self::Unreadable,
        }
    }
}

impl<T> Observation<T> {
    pub(crate) fn value(&self) -> Option<&T> {
        match self {
            Self::Value(value) => Some(value),
            Self::Unreadable => None,
        }
    }
}
