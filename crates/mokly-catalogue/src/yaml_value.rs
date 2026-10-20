//! Decoded YAML values are copied and released with heap work lists.
//!
//! `serde_json::Value` clones and drops recurse once per nesting level, so
//! authored values that the builder accepts are copied and released here.

use serde_json::{Map, Value};

use crate::yaml::Document;

impl Clone for Document {
    fn clone(&self) -> Self {
        Self {
            value: copy(&self.value),
            positions: self.positions.clone(),
        }
    }
}

impl Drop for Document {
    fn drop(&mut self) {
        discard(std::mem::take(&mut self.value));
    }
}

/// A value that is released without recursion when it goes out of scope.
pub(crate) struct Owned(pub(crate) Value);

impl Drop for Owned {
    fn drop(&mut self) {
        discard(std::mem::take(&mut self.0));
    }
}

/// Release a value of any depth without recursion.
pub(crate) fn discard(value: Value) {
    let mut pending = vec![value];
    while let Some(value) = pending.pop() {
        match value {
            Value::Array(values) => pending.extend(values),
            Value::Object(values) => pending.extend(values.into_iter().map(|(_, value)| value)),
            _ => {}
        }
    }
}

/// Copy a value of any depth without recursion.
pub(crate) fn copy(value: &Value) -> Value {
    let mut pending = vec![Step::Visit(value)];
    let mut built: Vec<Value> = Vec::new();
    while let Some(step) = pending.pop() {
        match step {
            Step::Visit(Value::Array(values)) => {
                pending.push(Step::Array(values.len()));
                pending.extend(values.iter().rev().map(Step::Visit));
            }
            Step::Visit(Value::Object(values)) => {
                pending.push(Step::Object(values));
                pending.extend(values.values().rev().map(Step::Visit));
            }
            Step::Visit(scalar) => built.push(scalar.clone()),
            Step::Array(count) => {
                let values = built.split_off(built.len() - count);
                built.push(Value::Array(values));
            }
            Step::Object(source) => {
                let values = built.split_off(built.len() - source.len());
                let object: Map<String, Value> = source.keys().cloned().zip(values).collect();
                built.push(Value::Object(object));
            }
        }
    }
    built.pop().unwrap_or_default()
}

/// One step of [`copy`]: visit a value, or assemble a container from built children.
enum Step<'a> {
    Visit(&'a Value),
    Array(usize),
    Object(&'a Map<String, Value>),
}
