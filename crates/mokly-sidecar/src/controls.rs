//! Declarative control metadata with no executable values.

use mokly_model::prop_schema::Primitive;
use serde::{Deserialize, Serialize};
use serde_json::Number;
use ts_rs::TS;

/// Shared control display metadata.
#[derive(Clone, Debug, Default, Deserialize, Serialize, TS)]
pub struct ControlLabel {
    /// Display label.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub label: Option<String>,
    /// Help text.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
}

/// One primitive select choice.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct ControlOption {
    /// Display label.
    pub label: String,
    /// Data value checked against the prop schema by the core.
    pub value: Primitive,
}

/// Editable data prop control.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Control {
    /// Bounded string input.
    Text {
        /// Shared display metadata.
        #[serde(flatten)]
        label: ControlLabel,
        /// Optional string bound.
        #[serde(rename = "maxLength", skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        max_length: Option<Number>,
    },
    /// Boolean input.
    Boolean {
        /// Shared display metadata.
        #[serde(flatten)]
        label: ControlLabel,
    },
    /// Bounded number input.
    Number {
        /// Shared display metadata.
        #[serde(flatten)]
        label: ControlLabel,
        /// Optional lower bound.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        minimum: Option<Number>,
        /// Optional upper bound.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        maximum: Option<Number>,
        /// Positive step measured from zero.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        step: Option<Number>,
    },
    /// Primitive choice input.
    Select {
        /// Shared display metadata.
        #[serde(flatten)]
        label: ControlLabel,
        /// Ordered allowed choices.
        options: Vec<ControlOption>,
    },
}

/// Storybook control annotations applied after schema inference.
#[derive(Clone, Debug, Default, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StoryHints {
    /// Primitive choices of the derived select.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub options: Option<Vec<Primitive>>,
    /// Number-control bounds and step.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub control: Option<StoryNumberHints>,
    /// Display label.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub name: Option<String>,
    /// Help text.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
}

/// Numeric Storybook annotations; they do not change schema validation.
#[derive(Clone, Debug, Default, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct StoryNumberHints {
    /// Lower control bound.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub min: Option<Number>,
    /// Upper control bound.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub max: Option<Number>,
    /// Positive step.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub step: Option<Number>,
}
