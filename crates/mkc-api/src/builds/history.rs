//! Closed history variants retain their serde-owned discriminator and fields.

use std::borrow::Cow;

use serde::Serialize;
use utoipa::openapi::schema::AdditionalProperties;
use utoipa::openapi::{RefOr, Schema};
use utoipa::{PartialSchema, ToSchema};

use crate::viewer::views::Publication;

use super::views::Build;

#[derive(Debug, Serialize)]
#[serde(transparent)]
pub(crate) struct HistoryEntry(HistoryEntryFields);

#[derive(Debug, Serialize, ToSchema)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
enum HistoryEntryFields {
    Publication { publication: Publication },
    Build { build: Build },
}

impl HistoryEntry {
    pub(crate) fn publication(publication: Publication) -> Self {
        Self(HistoryEntryFields::Publication { publication })
    }

    pub(crate) fn build(build: Build) -> Self {
        Self(HistoryEntryFields::Build { build })
    }
}

/// Utoipa does not propagate enum-level deny_unknown_fields to tagged variants.
impl PartialSchema for HistoryEntry {
    fn schema() -> RefOr<Schema> {
        let mut schema = HistoryEntryFields::schema();
        if let RefOr::T(Schema::OneOf(union)) = &mut schema {
            for variant in &mut union.items {
                if let RefOr::T(Schema::Object(object)) = variant {
                    object.additional_properties =
                        Some(Box::new(AdditionalProperties::FreeForm(false)));
                }
            }
        }
        schema
    }
}

impl ToSchema for HistoryEntry {
    fn name() -> Cow<'static, str> {
        Cow::Borrowed("HistoryEntry")
    }

    fn schemas(schemas: &mut Vec<(String, RefOr<Schema>)>) {
        HistoryEntryFields::schemas(schemas);
    }
}
