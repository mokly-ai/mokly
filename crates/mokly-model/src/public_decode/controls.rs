//! Control inputs accept additions but reject another control kind's bounds.

use serde::de::Error;
use serde::{Deserialize, Deserializer};

use crate::controls::ControlInput;

use super::raw::Record;

impl<'de> Deserialize<'de> for ControlInput {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut raw = Record::read(deserializer)?;
        let kind: String = raw.required("kind")?;
        match kind.as_str() {
            "text" => {
                raw.reject(&["minimum", "maximum", "step", "options"])?;
                Ok(Self::Text {
                    max_length: raw.optional("maxLength")?,
                })
            }
            "boolean" => {
                raw.reject(&["maxLength", "minimum", "maximum", "step", "options"])?;
                Ok(Self::Boolean)
            }
            "number" => {
                raw.reject(&["maxLength", "options"])?;
                Ok(Self::Number {
                    minimum: raw.optional("minimum")?,
                    maximum: raw.optional("maximum")?,
                    step: raw.optional("step")?,
                })
            }
            "select" => {
                raw.reject(&["maxLength", "minimum", "maximum", "step"])?;
                Ok(Self::Select {
                    options: raw.required("options")?,
                })
            }
            _ => Err(D::Error::unknown_variant(
                &kind,
                &["text", "boolean", "number", "select"],
            )),
        }
    }
}
