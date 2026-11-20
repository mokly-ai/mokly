//! Exact borrowed render equality retains signed zero without serializing another payload.

use std::collections::BTreeMap;

use serde_json::Value;

use crate::methods::{Call, Render};

pub(super) fn same_render(left: &Call, right: &Call) -> bool {
    match (left, right) {
        (Call::RenderScreen(left), Call::RenderScreen(right)) => render(left, right),
        (Call::RenderComponent(left), Call::RenderComponent(right)) => {
            render(&left.render, &right.render)
                && left.slots == right.slots
                && left.ignore_scope == right.ignore_scope
        }
        (Call::RenderStory(left), Call::RenderStory(right)) => {
            left.generation == right.generation
                && left.story_id == right.story_id
                && left.viewport == right.viewport
                && left.color_scheme == right.color_scheme
                && props(&left.props, &right.props)
        }
        (Call::RenderPage(left), Call::RenderPage(right)) => left == right,
        _ => false,
    }
}

fn render(left: &Render, right: &Render) -> bool {
    left.generation == right.generation
        && left.handle == right.handle
        && left.entry == right.entry
        && left.viewport == right.viewport
        && left.color_scheme == right.color_scheme
        && props(&left.props, &right.props)
}

fn props(left: &BTreeMap<String, Value>, right: &BTreeMap<String, Value>) -> bool {
    left.len() == right.len()
        && left
            .iter()
            .zip(right)
            .all(|((key, left), (other, right))| key == other && value(left, right))
}

fn value(left: &Value, right: &Value) -> bool {
    match (left, right) {
        (Value::Number(left), Value::Number(right)) => {
            left == right
                && left
                    .as_f64()
                    .zip(right.as_f64())
                    .is_none_or(|(left, right)| left.to_bits() == right.to_bits())
        }
        (Value::Array(left), Value::Array(right)) => {
            left.len() == right.len()
                && left
                    .iter()
                    .zip(right)
                    .all(|(left, right)| value(left, right))
        }
        (Value::Object(left), Value::Object(right)) => {
            left.len() == right.len()
                && left
                    .iter()
                    .all(|(key, left)| right.get(key).is_some_and(|right| value(left, right)))
        }
        _ => left == right,
    }
}
