//! Schema mirrors checked against the upstream error envelope by serde remote derives.

#![expect(
    dead_code,
    reason = "Serde remote definitions check the upstream fields and only supply schemas."
)]

use std::collections::BTreeSet;

use rpc_error::{ErrorCode, ErrorDetail, ErrorOutput};
use serde::Serialize;
use serde_json::Value;
use utoipa::openapi::extensions::Extensions;
use utoipa::openapi::schema::{Object, ObjectBuilder, OneOf, OneOfBuilder, Type};
use utoipa::openapi::{RefOr, Schema};
use utoipa::{PartialSchema, ToSchema};

use crate::error::ApiError;

use super::enum_values::enum_values;
use super::reason_data::REASON_DATA;

/// The rpc-error envelope. `code` is one of rpc-error's fixed standard codes;
/// upload refusals use HTTP 426 for unsupported versions, 408 for request
/// deadlines and 410 for expired or closed attempts; `reason`
/// is this API's stable kebab-case identifier for the condition, catalogued in
/// docs/protocol/cloud/rest-api.md; `message` is client-safe; `request_id` correlates
/// server diagnostics. `error` is one closed variant per `data` type, keyed by
/// `reason`, and one variant without `data` for every other reason.
#[derive(Serialize, ToSchema)]
#[serde(remote = "ErrorOutput", deny_unknown_fields)]
struct Envelope {
    #[serde(with = "Detail")]
    #[schema(value_type = Detail, inline)]
    error: ErrorDetail,
}

/// The documented error envelope, including the API's complete reason inventory.
pub(crate) struct Error;

impl PartialSchema for Error {
    fn schema() -> RefOr<Schema> {
        let mut schema = Envelope::schema();
        if let RefOr::T(Schema::Object(object)) = &mut schema {
            if let Some(RefOr::T(Schema::Object(detail))) = object.properties.get("error") {
                let variants = Schema::OneOf(variants(detail));
                object.properties.insert("error".into(), RefOr::T(variants));
            }
            object.extensions = Some(Extensions::from_iter([(
                "x-reasons",
                serde_json::json!(reason_names()),
            )]));
        }
        schema
    }
}

impl ToSchema for Error {
    fn schemas(schemas: &mut Vec<(String, RefOr<Schema>)>) {
        for data in &REASON_DATA {
            data.register(schemas);
        }
    }
}

#[derive(Serialize, ToSchema)]
#[serde(remote = "ErrorDetail", deny_unknown_fields)]
struct Detail {
    #[schema(schema_with = codes)]
    code: ErrorCode,
    /// Each variant narrows the reason to the reasons that share its `data`.
    reason: String,
    message: String,
    /// Incoming x-request-id text, otherwise a generated UUID.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(required, nullable = false)]
    request_id: Option<String>,
    /// Each variant documents the `data` type of its reasons, or omits `data`.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(ignore)]
    data: Option<Value>,
}

/// One closed variant per data type, then one for every reason without data.
fn variants(detail: &Object) -> OneOf {
    let mut plain = reason_names();
    let mut variants = OneOfBuilder::new();
    for data in &REASON_DATA {
        for reason in data.reasons {
            plain.remove(reason);
        }
        let reasons = data.reasons.iter().copied();
        variants = variants.item(variant(detail, reasons, Some(data.reference())));
    }
    variants.item(variant(detail, plain, None)).build()
}

/// The error object for `reasons`, which requires their `data` when they carry it.
fn variant(
    detail: &Object,
    reasons: impl IntoIterator<Item = &'static str>,
    data: Option<RefOr<Schema>>,
) -> Object {
    let mut variant = detail.clone();
    variant
        .properties
        .insert("reason".into(), reason(reasons).into());
    if let Some(data) = data {
        variant.properties.insert("data".into(), data);
        variant.required.push("data".into());
    }
    variant
}

fn codes() -> Object {
    ObjectBuilder::new()
        .schema_type(Type::String)
        .enum_values(Some(enum_values::<ErrorCode>().iter().copied()))
        .build()
}

fn reason(reasons: impl IntoIterator<Item = &'static str>) -> Object {
    ObjectBuilder::new()
        .schema_type(Type::String)
        .pattern(Some("^[a-z0-9]+(-[a-z0-9]+)*$"))
        .enum_values(Some(reasons))
        .description(Some(
            "Stable reason from this schema's x-reasons inventory and rest-api.md.",
        ))
        .build()
}

fn reason_names() -> BTreeSet<&'static str> {
    ApiError::reason_catalogs()
        .into_iter()
        .flatten()
        .map(|definition| definition.reason)
        .collect()
}

#[cfg(test)]
#[path = "_tests_/error_tests.rs"]
mod tests;
