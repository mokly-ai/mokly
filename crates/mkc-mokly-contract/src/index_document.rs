//! Decode only the index fields that the receiver uses; ignore all other fields.

use std::fmt;

use serde::Deserialize;
use serde::de::{self, Deserializer, IgnoredAny, MapAccess, SeqAccess, Visitor};

use crate::index_records::ViewAxes;
use crate::index_values::{ChangeKind, ChangesStatus};
use crate::json;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Document {
    #[serde(default, deserialize_with = "json::optional")]
    pub(crate) base: Option<String>,
    #[serde(default, deserialize_with = "json::optional")]
    pub(crate) base_commit: Option<String>,
    pub(crate) changes_status: ChangesStatus,
    #[serde(deserialize_with = "json::nullable")]
    pub(crate) comparison_url: Option<String>,
    pub(crate) components: Vec<CurrentRecord>,
    pub(crate) documents: Vec<CurrentRecord>,
    pub(crate) pages: Vec<CurrentRecord>,
    pub(crate) screens: Vec<ScreenRecord>,
    pub(crate) use_cases: Vec<CurrentRecord>,
    pub(crate) removed_entries: Vec<RemovedRecord>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CurrentRecord {
    pub(crate) path: String,
    pub(crate) title: String,
    #[serde(default, deserialize_with = "json::optional")]
    pub(crate) previous_path: Option<String>,
    pub(crate) changes: Changes,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScreenRecord {
    pub(crate) path: String,
    pub(crate) title: String,
    #[serde(default, deserialize_with = "json::optional")]
    pub(crate) previous_path: Option<String>,
    pub(crate) changes: Changes,
    pub(crate) views: Vec<ViewAxes>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct RemovedRecord {
    pub(crate) entry: HistoricalRecord,
}

#[derive(Debug, Deserialize)]
pub(crate) struct HistoricalRecord {
    pub(crate) path: String,
    pub(crate) title: String,
    pub(crate) changes: Changes,
}

#[derive(Clone, Copy, Debug)]
pub(crate) enum Changes {
    Preparing,
    Pending,
    Unavailable,
    Disabled,
    Ready { kind: ChangeKind, included: bool },
}

impl Changes {
    pub(crate) fn counted_kind(self) -> Option<ChangeKind> {
        match self {
            Self::Ready {
                kind,
                included: true,
            } => Some(kind),
            _ => None,
        }
    }
}

impl<'de> Deserialize<'de> for Changes {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_map(ChangesVisitor)
    }
}

#[derive(Deserialize)]
#[serde(field_identifier, rename_all = "lowercase")]
enum Field {
    Status,
    Kind,
    Included,
    #[serde(other)]
    Unknown,
}

struct ChangesVisitor;

impl<'de> Visitor<'de> for ChangesVisitor {
    type Value = Changes;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a Changes object")
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Changes, A::Error> {
        let mut status = None;
        let mut kind = FieldValue::Ignored;
        let mut included = FieldValue::Ignored;
        while let Some(field) = map.next_key()? {
            match field {
                Field::Status => status = Some(map.next_value()?),
                Field::Kind => kind = map.next_value()?,
                Field::Included => included = map.next_value()?,
                Field::Unknown => {
                    map.next_value::<IgnoredAny>()?;
                }
            }
        }
        match status {
            Some(ChangesStatus::Preparing) => Ok(Changes::Preparing),
            Some(ChangesStatus::Pending) => Ok(Changes::Pending),
            Some(ChangesStatus::Unavailable) => Ok(Changes::Unavailable),
            Some(ChangesStatus::Disabled) => Ok(Changes::Disabled),
            Some(ChangesStatus::Ready) => match (kind, included) {
                (FieldValue::Kind(kind), FieldValue::Included(included)) => {
                    Ok(Changes::Ready { kind, included })
                }
                _ => Err(de::Error::custom(
                    "ready Changes requires a kind and included flag",
                )),
            },
            None => Err(de::Error::missing_field("status")),
        }
    }
}

/// Keep recognized scalars until the status tells us whether they are required.
enum FieldValue {
    Kind(ChangeKind),
    Included(bool),
    Ignored,
}

impl<'de> Deserialize<'de> for FieldValue {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(FieldValueVisitor)
    }
}

struct FieldValueVisitor;

impl<'de> Visitor<'de> for FieldValueVisitor {
    type Value = FieldValue;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON value")
    }

    fn visit_str<E>(self, value: &str) -> Result<FieldValue, E> {
        Ok(match value {
            "added" => FieldValue::Kind(ChangeKind::Added),
            "changed" => FieldValue::Kind(ChangeKind::Changed),
            "removed" => FieldValue::Kind(ChangeKind::Removed),
            "unmodified" => FieldValue::Kind(ChangeKind::Unmodified),
            _ => FieldValue::Ignored,
        })
    }

    fn visit_bool<E>(self, value: bool) -> Result<FieldValue, E> {
        Ok(FieldValue::Included(value))
    }

    fn visit_unit<E>(self) -> Result<FieldValue, E> {
        Ok(FieldValue::Ignored)
    }

    fn visit_i64<E>(self, _: i64) -> Result<FieldValue, E> {
        Ok(FieldValue::Ignored)
    }

    fn visit_u64<E>(self, _: u64) -> Result<FieldValue, E> {
        Ok(FieldValue::Ignored)
    }

    fn visit_f64<E>(self, _: f64) -> Result<FieldValue, E> {
        Ok(FieldValue::Ignored)
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut sequence: A) -> Result<FieldValue, A::Error> {
        while sequence.next_element::<IgnoredAny>()?.is_some() {}
        Ok(FieldValue::Ignored)
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<FieldValue, A::Error> {
        while map.next_entry::<IgnoredAny, IgnoredAny>()?.is_some() {}
        Ok(FieldValue::Ignored)
    }
}
