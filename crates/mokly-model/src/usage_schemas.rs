//! Publication-local prop validators shared by every recorded component instance.

use std::collections::BTreeMap;

use crate::data::Props;
use crate::detail_context::invalid;
use crate::diagnostic::{AuthoringKind, Context};
use crate::public_records::CatalogueComponent;
use crate::read_contract::ContractViolation;
use crate::readers::ReadError;
use crate::validation::PropValidator;

/// Lazily compile each component schema at most once per publication.
pub struct UsageSchemas<'a> {
    pub(crate) components: &'a [CatalogueComponent],
    by_path: BTreeMap<&'a str, &'a CatalogueComponent>,
    validators: BTreeMap<String, PropValidator>,
    #[cfg(test)]
    compilations: usize,
}

impl<'a> UsageSchemas<'a> {
    /// Start a validation pass without compiling unused schemas.
    pub fn new(components: &'a [CatalogueComponent]) -> Self {
        Self {
            components,
            by_path: components
                .iter()
                .filter(|component| component.variant_of.is_none())
                .map(|component| (component.entry.path.as_str(), component))
                .collect(),
            validators: BTreeMap::new(),
            #[cfg(test)]
            compilations: 0,
        }
    }

    pub(crate) fn component(&self, path: &str) -> Option<&CatalogueComponent> {
        self.by_path.get(path).copied()
    }

    pub(crate) fn validate(&mut self, path: &str, props: &Props) -> Result<(), ReadError> {
        let context = Context {
            entry: path.into(),
            variant: None,
            kind: AuthoringKind::Html,
        };
        if !self.validators.contains_key(path) {
            let component = self
                .component(path)
                .ok_or_else(|| invalid(ContractViolation::UsageReference))?;
            let schema = match serde_json::to_value(&component.visual.prop_schema) {
                Ok(schema) => schema,
                Err(_) => return Err(invalid(ContractViolation::UsageProps)),
            };
            let validator = match PropValidator::compile(&schema, &context) {
                Ok(validator) => validator,
                Err(_) => return Err(invalid(ContractViolation::UsageProps)),
            };
            self.validators.insert(path.into(), validator);
            #[cfg(test)]
            {
                self.compilations += 1;
            }
        }
        let props = match serde_json::to_value(props) {
            Ok(props) => props,
            Err(_) => return Err(invalid(ContractViolation::UsageProps)),
        };
        if self.validators[path].validate(&props, &context).is_err() {
            return Err(invalid(ContractViolation::UsageProps));
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/usage_schemas_tests.rs"]
mod usage_schemas_tests;
