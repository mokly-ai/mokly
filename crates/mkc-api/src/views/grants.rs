//! Grants response schemas.

use std::borrow::Cow;

use mkc_domain::ids::{GrantId, UserId};
use mkc_domain::values::Role;
use serde::Serialize;
use serde_json::json;
use utoipa::openapi::extensions::Extensions;
use utoipa::openapi::{RefOr, Schema};
use utoipa::{PartialSchema, ToSchema};

use crate::contract::scalars::project_role;

/// Direct or inherited access with conditional identity and version fields.
#[derive(Clone, Debug, Serialize)]
#[serde(transparent)]
pub(crate) struct GrantView(pub(crate) GrantViewFields);

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct GrantViewFields {
    #[schema(required, value_type = Option<Uuid>)]
    pub(crate) id: Option<GrantId>,
    #[schema(inline)]
    pub(crate) user_id: UserId,
    pub(crate) name: String,
    #[schema(schema_with = project_role)]
    pub(crate) role: Role,
    pub(crate) inherited: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(nullable = false, minimum = 1)]
    pub(crate) version: Option<i64>,
}

/// JSON Schema conditionals are serialized through extensions because utoipa has no if/then model.
/// Keeping the base object intact also avoids null-only fields in openapi-fetch's Readable type.
impl PartialSchema for GrantView {
    fn schema() -> RefOr<Schema> {
        let mut fields = GrantViewFields::schema();
        if let RefOr::T(Schema::Object(object)) = &mut fields {
            object.extensions = Some(Extensions::from_iter([(
                "allOf",
                json!([{
                    "if": {"properties": {"inherited": {"const": true}}},
                    "then": {"properties": {"id": {"type": "null"}, "version": false}},
                    "else": {
                        "required": ["version"],
                        "properties": {
                            "id": {"type": "string"},
                            "version": object.properties.get("version"),
                        },
                    },
                }]),
            )]));
        }
        fields
    }
}

impl ToSchema for GrantView {
    fn schemas(schemas: &mut Vec<(String, RefOr<Schema>)>) {
        GrantViewFields::schemas(schemas);
    }

    fn name() -> Cow<'static, str> {
        Cow::Borrowed("ProjectGrant")
    }
}
