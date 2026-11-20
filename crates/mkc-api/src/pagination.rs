//! Strict cursor parsing and permission-filtered list windows.

use uuid::Uuid;

use crate::payload::Page;
use crate::platform::error::{Error, Result};

#[derive(Clone, Copy, Debug)]
pub(crate) struct Pagination {
    pub(crate) cursor: Option<Uuid>,
    pub(crate) limit: usize,
}

impl Pagination {
    pub(crate) fn parse(query: &str) -> Result<Self> {
        let mut cursor = None;
        let mut limit = None;
        for (key, value) in url::form_urlencoded::parse(query.as_bytes()) {
            match key.as_ref() {
                "cursor" if cursor.is_none() => {
                    cursor = Some(match value.parse() {
                        Ok(id) => id,
                        Err(_) => return Err(Error::InvalidInput),
                    })
                }
                "limit" if limit.is_none() => {
                    limit = Some(parse_limit(&value)?);
                }
                _ => return Err(Error::InvalidInput),
            }
        }
        Ok(Self {
            cursor,
            limit: limit.unwrap_or(50),
        })
    }

    pub(crate) fn page<T>(&self, mut values: Vec<T>, id: impl Fn(&T) -> Uuid) -> Page<T> {
        values.sort_by_key(&id);
        values.retain(|value| self.cursor.is_none_or(|cursor| id(value) > cursor));
        let more = values.len() > self.limit;
        values.truncate(self.limit);
        let next_cursor = if more {
            values.last().map(|value| id(value).to_string())
        } else {
            None
        };
        Page {
            items: values,
            next_cursor,
        }
    }
}

/// Shared list-limit contract, including viewer lists with compound cursors.
pub(crate) fn parse_limit(value: &str) -> Result<usize> {
    match value.parse::<usize>() {
        Ok(limit) if (1..=100).contains(&limit) => Ok(limit),
        _ => Err(Error::InvalidInput),
    }
}
