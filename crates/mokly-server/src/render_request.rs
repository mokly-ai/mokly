//! Strict live prop request decoding and complete schema/control validation.

use std::collections::BTreeMap;

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::controls::{self, ControlInput};
use mokly_model::data::{DataValue, Props};
use mokly_model::diagnostic::{AuthoringKind, Context};
use mokly_model::prop_schema::{JsonType, PropSchema, Types};
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::public_records::CatalogueVisual;
use mokly_model::validation::{PropValidator, accepts};
use mokly_model::{routes, wire_decode};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// One complete temporary prop edit, without source or renderer selection.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RenderRequest {
    /// Current screen, component, or variant path.
    pub entry_path: String,
    /// Installed viewport.
    pub viewport: Viewport,
    /// Installed appearance.
    pub color_scheme: ColorScheme,
    /// Installed publication revision.
    pub revision: u64,
    /// Context-local queue identity, never authority.
    pub page_id: String,
    /// Controlled top-level edits.
    pub overrides: BTreeMap<String, Override>,
}

/// A JSON value or removal of an optional controlled prop.
#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum Override {
    /// Set an ordinary JSON value.
    Set {
        /// Data validated against the entry's schema.
        value: DataValue,
    },
    /// Remove an optional controlled prop.
    Unset {},
}

/// Stable render HTTP failure categories.
#[derive(Clone, Copy, Debug, Error, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum Rejection {
    /// Malformed request, uncontrolled prop, or invalid value.
    #[error("[mokly-server/render] invalid live render input")]
    InvalidInput,
    /// Entry is absent or has no editable views.
    #[error("[mokly-server/render] unknown live render entry")]
    UnknownEntry,
    /// Installed revision no longer matches.
    #[error("[mokly-server/render] live render revision is stale")]
    StaleRevision,
    /// The renderer rejected or timed out.
    #[error("[mokly-server/render] temporary render failed")]
    RenderFailed,
    /// Queue or memory budget is full.
    #[error("[mokly-server/render] temporary render capacity is full")]
    Capacity,
}

/// A validated route and complete data props.
#[derive(Debug)]
pub struct ValidatedRender {
    /// Existing generated view route.
    pub route: String,
    /// Complete props after overrides.
    pub props: Props,
}

/// Validate a request against one immutable catalogue publication.
pub fn validate(
    request: &RenderRequest,
    index: &CatalogueReadModel,
) -> Result<ValidatedRender, Rejection> {
    if request.revision != index.revision {
        return Err(Rejection::StaleRevision);
    }
    if request.page_id.len() != 32 || !request.page_id.bytes().all(|byte| byte.is_ascii_hexdigit())
    {
        return Err(Rejection::InvalidInput);
    }
    let visual = index
        .screens
        .iter()
        .find(|entry| entry.entry.path == request.entry_path)
        .map(|entry| &entry.visual)
        .or_else(|| {
            index
                .components
                .iter()
                .find(|entry| entry.entry.path == request.entry_path)
                .map(|entry| &entry.visual)
        })
        .ok_or(Rejection::UnknownEntry)?;
    if !visual
        .views
        .iter()
        .any(|view| view.viewport == request.viewport && view.color_scheme == request.color_scheme)
    {
        return Err(Rejection::InvalidInput);
    }
    let mut props = match wire_decode::decode(&visual.props) {
        Ok(props) => props,
        Err(_) => return Err(Rejection::InvalidInput),
    };
    for (name, edit) in &request.overrides {
        let control = visual.controls.get(name).ok_or(Rejection::InvalidInput)?;
        match edit {
            Override::Set { value } => {
                if !controlled(&control.input, value) {
                    return Err(Rejection::InvalidInput);
                }
                props.insert(name.clone(), value.clone());
            }
            Override::Unset {} => {
                if visual
                    .prop_schema
                    .required
                    .as_ref()
                    .is_some_and(|required| required.contains(name))
                {
                    return Err(Rejection::InvalidInput);
                }
                props.remove(name);
            }
        }
    }
    if !valid_props(visual, &props, &request.entry_path) {
        return Err(Rejection::InvalidInput);
    }
    Ok(ValidatedRender {
        route: routes::view(&request.entry_path, request.viewport, request.color_scheme),
        props,
    })
}

fn valid_props(visual: &CatalogueVisual, props: &Props, path: &str) -> bool {
    let context = Context {
        entry: path.into(),
        variant: None,
        kind: AuthoringKind::Html,
    };
    let Ok(props) = serde_json::to_value(props) else {
        return false;
    };
    for schema in [
        &visual.prop_schema,
        &controls::with_bounds(&visual.prop_schema, &visual.controls),
    ] {
        let Ok(schema) = serde_json::to_value(schema) else {
            return false;
        };
        let Ok(validator) = PropValidator::compile(&schema, &context) else {
            return false;
        };
        if validator.validate(&props, &context).is_err() {
            return false;
        }
    }
    true
}

fn controlled(control: &ControlInput, value: &DataValue) -> bool {
    match (control, value) {
        (ControlInput::Text { max_length }, DataValue::String(text)) => max_length
            .as_ref()
            .and_then(|number| number.as_u64())
            .is_none_or(|maximum| text.chars().count() as u64 <= maximum),
        (ControlInput::Boolean, DataValue::Boolean(_)) => true,
        (
            ControlInput::Number {
                minimum,
                maximum,
                step,
            },
            DataValue::Number(_),
        ) => accepts(
            &PropSchema {
                types: Some(Types::Single(JsonType::Number)),
                minimum: minimum.clone(),
                maximum: maximum.clone(),
                multiple_of: step.clone(),
                ..Default::default()
            },
            value,
        ),
        (ControlInput::Select { options }, _) => accepts(
            &PropSchema {
                enumeration: Some(options.iter().map(|option| option.value.clone()).collect()),
                ..Default::default()
            },
            value,
        ),
        _ => false,
    }
}

#[cfg(test)]
#[path = "_tests_/render_request_tests.rs"]
mod render_request_tests;
