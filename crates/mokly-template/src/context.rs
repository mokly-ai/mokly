//! Convert plain props into the values used by MiniJinja.

use std::collections::BTreeMap;
use std::sync::Arc;

use minijinja::Value;
use minijinja::value::{Enumerator, Object, ObjectRepr, Serde};
use mokly_model::data::{DataValue, Props};
use mokly_model::prop_schema::PropSchema;

use crate::format::attribute;

#[derive(Debug)]
struct Absent;

impl Object for Absent {
    fn repr(self: &Arc<Self>) -> ObjectRepr {
        ObjectRepr::Iterable
    }

    fn get_value(self: &Arc<Self>, _key: &Value) -> Option<Value> {
        Some(Value::from_dyn_object(Arc::clone(self)))
    }
}

pub(crate) fn is_absent(value: &Value) -> bool {
    value.downcast_object_ref::<Absent>().is_some()
}

/// The private lookup exists only under a name chosen outside the body's authored identifiers.
#[derive(Debug)]
struct RenderContext {
    props: Arc<BTreeMap<String, Value>>,
    private_name: Arc<str>,
    private: Value,
}

impl Object for RenderContext {
    fn get_value(self: &Arc<Self>, key: &Value) -> Option<Value> {
        self.get_value_by_str(key.as_str()?)
    }

    fn get_value_by_str(self: &Arc<Self>, key: &str) -> Option<Value> {
        if key == self.private_name.as_ref() {
            Some(self.private.clone())
        } else {
            self.props.get(key).cloned()
        }
    }

    fn enumerate(self: &Arc<Self>) -> Enumerator {
        self.props.enumerate()
    }
}

pub(crate) fn context(
    props: &Props,
    schema: &PropSchema,
    private_name: Option<&Arc<str>>,
) -> Value {
    let map = object(props, Some(schema), &Value::from_object(Absent));
    let Some(private_name) = private_name else {
        return Value::from_object(map);
    };
    let props = Arc::new(map);
    let private = Value::from_pairs([
        ("props", Value::from_dyn_object(Arc::clone(&props))),
        ("attribute", Value::from_function(attribute)),
    ]);
    Value::from_object(RenderContext {
        props,
        private_name: Arc::clone(private_name),
        private,
    })
}

fn object(props: &Props, schema: Option<&PropSchema>, absent: &Value) -> BTreeMap<String, Value> {
    let properties = schema.and_then(|schema| schema.properties.as_ref());
    let mut values: BTreeMap<_, _> = props
        .iter()
        .map(|(name, value)| {
            let schema = properties.and_then(|properties| properties.get(name));
            (name.clone(), convert(value, schema, absent))
        })
        .collect();
    if let Some(properties) = properties {
        let required = schema.and_then(|schema| schema.required.as_ref());
        for name in properties.keys() {
            if !values.contains_key(name)
                && required.is_none_or(|required| !required.contains(name))
            {
                values.insert(name.clone(), absent.clone());
            }
        }
    }
    values
}

fn convert(value: &DataValue, schema: Option<&PropSchema>, absent: &Value) -> Value {
    match value {
        DataValue::Null => Value::from(()),
        DataValue::Boolean(value) => Value::from(*value),
        DataValue::Number(value) => Value::from(Serde(value)),
        DataValue::String(value) => Value::from(value.as_str()),
        DataValue::Array(values) => {
            let items = schema.and_then(|schema| schema.items.as_deref());
            Value::from_iter(values.iter().map(|value| convert(value, items, absent)))
        }
        DataValue::Object(props) => Value::from_object(object(props, schema, absent)),
    }
}
