//! Capacity charges for the two root input contexts retained across admission.

use std::mem;

use mokly_model::data::{DataValue, Props};
use mokly_model::prop_schema::{Constant, JsonType, Primitive, PropSchema, Types};

use crate::composition::{ComposeRequest, Engine};
use crate::context::Context;

pub(crate) fn retained(request: &ComposeRequest<'_>, context: &Context) -> usize {
    mem::size_of::<Engine<'_>>()
        + mem::size_of::<ComposeRequest<'_>>()
        + strings(&request.stylesheets)
        + 2 * (mem::size_of::<Context>()
            + props(&context.props)
            + schema(&context.schema)
            + context.source.path.capacity()
            + context.source.export.as_ref().map_or(0, String::capacity)
            + context.link_base.capacity()
            + strings(&context.declared_slots))
        + 2 * mem::size_of::<usize>()
}

fn strings(values: &Vec<String>) -> usize {
    values.capacity() * mem::size_of::<String>()
        + values.iter().map(String::capacity).sum::<usize>()
}

fn props(props: &Props) -> usize {
    props
        .iter()
        .map(|(key, value)| 256 + key.capacity() + mem::size_of_val(value) + data(value))
        .sum()
}

fn data(value: &DataValue) -> usize {
    match value {
        DataValue::String(value) => value.capacity(),
        DataValue::Object(values) => props(values),
        DataValue::Array(values) => {
            values.capacity() * mem::size_of::<DataValue>() + values.iter().map(data).sum::<usize>()
        }
        DataValue::Null | DataValue::Boolean(_) | DataValue::Number(_) => 0,
    }
}

fn primitive(value: &Primitive) -> usize {
    match value {
        Primitive::String(value) => value.capacity(),
        Primitive::Number(_) | Primitive::Boolean(_) | Primitive::Null => 0,
    }
}

fn schema(value: &PropSchema) -> usize {
    let mut bytes = value.title.as_ref().map_or(0, String::capacity)
        + value.description.as_ref().map_or(0, String::capacity)
        + value.schema.as_ref().map_or(0, String::capacity)
        + value.required.as_ref().map_or(0, strings)
        + value.constant.as_ref().map_or(0, primitive);
    if let Some(Types::Union(types)) = &value.types {
        bytes += types.capacity() * mem::size_of::<JsonType>();
    }
    if let Some(properties) = &value.properties {
        bytes += properties
            .iter()
            .map(|(key, value)| 256 + key.capacity() + mem::size_of::<PropSchema>() + schema(value))
            .sum::<usize>();
    }
    if let Some(values) = &value.enumeration {
        bytes += values.capacity() * mem::size_of::<Primitive>()
            + values.iter().map(primitive).sum::<usize>();
    }
    if let Some(values) = &value.one_of {
        bytes += values.capacity() * mem::size_of::<Constant>()
            + values
                .iter()
                .map(|value| {
                    primitive(&value.value) + value.title.as_ref().map_or(0, String::capacity)
                })
                .sum::<usize>();
    }
    if let Some(values) = &value.any_of {
        bytes += values.capacity() * mem::size_of::<PropSchema>()
            + values.iter().map(schema).sum::<usize>();
    }
    if let Some(value) = &value.items {
        bytes += mem::size_of::<PropSchema>() + schema(value);
    }
    bytes
}
