//! Find unsafe integer values in nested property schemas.

use mokly_model::limits::pointer;
use mokly_model::prop_schema::{Primitive, PropSchema};
use serde_json::Number;

/// Return JSON pointers for unsafe schema keyword numbers.
pub(crate) fn schema_paths(schema: &PropSchema) -> Vec<String> {
    let mut paths = Vec::new();
    let mut pending = vec![(String::new(), schema)];
    while let Some((path, schema)) = pending.pop() {
        for (keyword, value) in [
            ("minimum", &schema.minimum),
            ("maximum", &schema.maximum),
            ("multipleOf", &schema.multiple_of),
            ("minLength", &schema.min_length),
            ("maxLength", &schema.max_length),
            ("minItems", &schema.min_items),
            ("maxItems", &schema.max_items),
        ] {
            record(value.as_ref(), pointer(&path, keyword), &mut paths);
        }
        let choices = schema
            .enumeration
            .iter()
            .flatten()
            .enumerate()
            .map(|(index, value)| (pointer(&pointer(&path, "enum"), &index.to_string()), value))
            .chain(
                schema
                    .constant
                    .iter()
                    .map(|value| (pointer(&path, "const"), value)),
            )
            .chain(
                schema
                    .one_of
                    .iter()
                    .flatten()
                    .enumerate()
                    .map(|(index, value)| {
                        (
                            pointer(
                                &pointer(&pointer(&path, "oneOf"), &index.to_string()),
                                "const",
                            ),
                            &value.value,
                        )
                    }),
            );
        for (path, value) in choices {
            if let Primitive::Number(value) = value {
                record(Some(value), path, &mut paths);
            }
        }
        pending.extend(
            schema
                .properties
                .iter()
                .flatten()
                .map(|(key, schema)| (pointer(&pointer(&path, "properties"), key), schema)),
        );
        pending.extend(
            schema
                .items
                .iter()
                .map(|schema| (pointer(&path, "items"), schema.as_ref())),
        );
        pending.extend(
            schema
                .any_of
                .iter()
                .flatten()
                .enumerate()
                .map(|(index, schema)| {
                    (
                        pointer(&pointer(&path, "anyOf"), &index.to_string()),
                        schema,
                    )
                }),
        );
    }
    paths.sort();
    paths
}

fn record(number: Option<&Number>, path: String, paths: &mut Vec<String>) {
    if number
        .and_then(Number::as_f64)
        .is_some_and(|value| value.fract() == 0.0 && value.abs() > 9_007_199_254_740_991.0)
    {
        paths.push(path);
    }
}
