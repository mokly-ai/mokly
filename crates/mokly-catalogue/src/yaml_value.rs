//! Stack-independent ownership of decoded YAML, including aliases and error cleanup.

use serde_json::Value;

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

fn copy(value: &Value) -> Value {
    let mut pending = vec![Copy::Visit(value)];
    let mut values = Vec::new();
    while let Some(job) = pending.pop() {
        match job {
            Copy::Visit(Value::Array(children)) => {
                pending.push(Copy::Array(children.len()));
                pending.extend(children.iter().rev().map(Copy::Visit));
            }
            Copy::Visit(Value::Object(children)) => {
                pending.push(Copy::Object(children.keys().cloned().collect()));
                pending.extend(children.values().rev().map(Copy::Visit));
            }
            Copy::Visit(value) => values.push(value.clone()),
            Copy::Array(count) => {
                let children = values.split_off(values.len() - count);
                values.push(Value::Array(children));
            }
            Copy::Object(keys) => {
                let children = values.split_off(values.len() - keys.len());
                values.push(Value::Object(keys.into_iter().zip(children).collect()));
            }
        }
    }
    values.pop().unwrap_or(Value::Null)
}

enum Copy<'a> {
    Visit(&'a Value),
    Array(usize),
    Object(Vec<String>),
}
