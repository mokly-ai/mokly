//! The single Rust schema and props validator.

use jsonschema::error::ValidationErrorKind;
use jsonschema::{ValidationError, Validator};
use serde_json::Value;

use crate::diagnostic::Context;
use crate::error::{ModelError, Result};
use crate::limits;
use crate::profile;
use crate::prop_schema::PropSchema;

/// Compiled, bounded prop schema with its normative structured shape.
pub struct PropValidator {
    schema: PropSchema,
    validator: Validator,
}

impl PropValidator {
    /// Validate a schema against the profile and the draft 2020-12 metaschema.
    pub fn compile(value: &Value, context: &Context) -> Result<Self> {
        if let Err((path, message)) = limits::check(value, false) {
            return Err(ModelError::Schema(context.diagnostic(true, &path, message)));
        }
        if let Err((path, message)) = profile::check(value, "", true) {
            return Err(ModelError::Schema(context.diagnostic(true, &path, message)));
        }
        let validator = match jsonschema::draft202012::options().build(value) {
            Ok(validator) => validator,
            Err(error) => {
                return Err(ModelError::Schema(context.diagnostic(
                    true,
                    error.instance_path().as_str(),
                    error.to_string(),
                )));
            }
        };
        let schema = match serde_json::from_value(value.clone()) {
            Ok(schema) => schema,
            Err(error) => {
                return Err(ModelError::Schema(context.diagnostic(
                    true,
                    "",
                    error.to_string(),
                )));
            }
        };
        Ok(Self { schema, validator })
    }

    /// Return the validated schema for serialization or control derivation.
    pub fn schema(&self) -> &PropSchema {
        &self.schema
    }

    /// Check complete props without inserting defaults or coercing values.
    /// JSON decoding excludes executable values, cycles and non-finite numbers.
    pub fn validate(&self, props: &Value, context: &Context) -> Result<()> {
        if let Err((path, message)) = limits::check(props, true) {
            return Err(ModelError::Props(context.diagnostic(false, &path, message)));
        }
        if let Err(error) = self.validator.validate(props) {
            return Err(ModelError::Props(context.diagnostic(
                false,
                &property_path(&error),
                error.to_string(),
            )));
        }
        Ok(())
    }
}

fn property_path(error: &ValidationError<'_>) -> String {
    let path = error.instance_path().as_str();
    match error.kind() {
        ValidationErrorKind::Required { property } => property
            .as_str()
            .map_or_else(|| path.to_owned(), |name| limits::pointer(path, name)),
        ValidationErrorKind::AdditionalProperties { unexpected } => unexpected
            .first()
            .map_or_else(|| path.to_owned(), |name| limits::pointer(path, name)),
        _ => path.to_owned(),
    }
}

#[cfg(test)]
#[path = "_tests_/validation_tests.rs"]
mod validation_tests;
