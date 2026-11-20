//! Strict build reference bodies and monotonic log windows.

use std::collections::BTreeMap;

use mkc_domain::ids::{BuildId, ProjectId};
use serde::Deserialize;
use serde_json::json;
use utoipa::openapi::schema::{Object, ObjectBuilder, Type};
use utoipa::{IntoParams, ToSchema};

use crate::error::{ApiError, Result};
use crate::pagination::parse_limit;

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(untagged)]
#[schema(as = RequestBuild)]
pub(crate) enum Reference {
    Branch(#[schema(inline)] Branch),
    PullRequest(#[schema(inline)] PullRequest),
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub(crate) struct Branch {
    /// Nonempty branch name with no control characters and at most 255 UTF-8 bytes.
    #[schema(min_length = 1, max_length = 255)]
    pub(crate) branch: String,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PullRequest {
    #[schema(minimum = 1)]
    pub(crate) pull_request: i64,
}

impl Reference {
    pub(crate) fn validate(&self) -> Result<()> {
        let valid = match self {
            Self::Branch(value) => {
                !value.branch.is_empty()
                    && value.branch.len() <= 255
                    && !value.branch.chars().any(char::is_control)
            }
            Self::PullRequest(value) => value.pull_request > 0,
        };
        if !valid {
            return Err(ApiError::ValidationFailed);
        }
        Ok(())
    }
}

#[derive(Debug)]
pub(crate) enum Action {
    History(ProjectId),
    Build(ProjectId, BuildId),
    Log(ProjectId, BuildId),
    Request(ProjectId, Reference),
    Cancel(ProjectId, BuildId),
}

#[derive(Debug, IntoParams)]
#[into_params(parameter_in = Query)]
pub(crate) struct LogQuery {
    #[param(required = false, schema_with = log_after)]
    pub(super) after: i64,
    #[param(required = false, schema_with = log_limit)]
    pub(super) limit: i64,
}

impl LogQuery {
    pub(super) fn parse(query: &str) -> Result<Self> {
        let mut values = BTreeMap::new();
        for (key, value) in url::form_urlencoded::parse(query.as_bytes()) {
            if values
                .insert(key.into_owned(), value.into_owned())
                .is_some()
            {
                return Err(ApiError::ValidationFailed);
            }
        }
        let after = match values.remove("after") {
            Some(value) if !value.is_empty() && value.bytes().all(|b| b.is_ascii_digit()) => {
                match value.parse::<i64>() {
                    Ok(value) => value,
                    Err(_) => return Err(ApiError::ValidationFailed),
                }
            }
            Some(_) => return Err(ApiError::ValidationFailed),
            None => 0,
        };
        let limit = values
            .remove("limit")
            .map(|value| parse_limit(&value))
            .transpose()?
            .unwrap_or(100) as i64;
        if !values.is_empty() {
            return Err(ApiError::ValidationFailed);
        }
        Ok(Self { after, limit })
    }
}

fn log_after() -> Object {
    ObjectBuilder::new()
        .schema_type(Type::Integer)
        .minimum(Some(0.0))
        .default(Some(json!(0)))
        .build()
}

fn log_limit() -> Object {
    ObjectBuilder::new()
        .schema_type(Type::Integer)
        .minimum(Some(1.0))
        .maximum(Some(100.0))
        .default(Some(json!(100)))
        .build()
}
