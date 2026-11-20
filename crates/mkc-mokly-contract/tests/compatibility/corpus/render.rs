//! Deterministic UTF-16 serialization with an exact raw-text escape hatch.

use serde_json::Value;

use super::model::{Case, Operation};

/// Apply authored operations, or return raw bytes without parsing and sorting them.
pub(crate) fn document(base: &Value, case: &Case) -> String {
    match (&case.patch, &case.raw_document) {
        (None, Some(raw)) => raw.clone(),
        (Some(operations), None) => {
            let mut value = base.clone();
            for operation in operations {
                apply(&mut value, operation);
            }
            canonical(&value)
        }
        _ => panic!("{} requires exactly one patch or raw document", case.name),
    }
}

fn parts(pointer: &str) -> Vec<String> {
    assert!(pointer.starts_with('/'));
    pointer[1..]
        .split('/')
        .map(|part| {
            for (index, byte) in part.bytes().enumerate() {
                if byte == b'~' {
                    assert!(matches!(part.as_bytes().get(index + 1), Some(b'0' | b'1')));
                }
            }
            part.replace("~1", "/").replace("~0", "~")
        })
        .collect()
}

fn index(part: &str, len: usize) -> usize {
    let index: usize = part.parse().unwrap();
    assert_eq!(index.to_string(), part);
    assert!(index < len);
    index
}

fn apply(document: &mut Value, operation: &Operation) {
    let path = match operation {
        Operation::Set { path, .. } | Operation::Remove { path } => path,
    };
    if path.is_empty() {
        let Operation::Set { value, .. } = operation else {
            panic!("cannot remove the root")
        };
        *document = value.clone();
        return;
    }
    let parts = parts(path);
    let (leaf, ancestors) = parts.split_last().unwrap();
    let mut parent = document;
    for part in ancestors {
        parent = match parent {
            Value::Object(values) => values.get_mut(part).unwrap(),
            Value::Array(values) => {
                let index = index(part, values.len());
                &mut values[index]
            }
            _ => panic!("non-container pointer: {path}"),
        };
    }
    match parent {
        Value::Object(values) => match operation {
            Operation::Set { value, .. } => {
                values.insert(leaf.clone(), value.clone());
            }
            Operation::Remove { .. } => {
                assert!(values.remove(leaf).is_some());
            }
        },
        Value::Array(values) => {
            let index = index(leaf, values.len());
            match operation {
                Operation::Set { value, .. } => values[index] = value.clone(),
                Operation::Remove { .. } => {
                    values.remove(index);
                }
            }
        }
        _ => panic!("non-container pointer: {path}"),
    }
}

/// Serialize exactly like the Node harness, including integer-looking object keys.
pub(crate) fn canonical(value: &Value) -> String {
    match value {
        Value::Object(values) => {
            let mut keys: Vec<_> = values.keys().collect();
            keys.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
            let entries = keys
                .into_iter()
                .map(|key| {
                    format!(
                        "{}:{}",
                        serde_json::to_string(key).unwrap(),
                        canonical(&values[key])
                    )
                })
                .collect::<Vec<_>>()
                .join(",");
            format!("{{{entries}}}")
        }
        Value::Array(values) => format!(
            "[{}]",
            values.iter().map(canonical).collect::<Vec<_>>().join(",")
        ),
        Value::Number(number) => {
            let mut buffer = ryu_js::Buffer::new();
            buffer.format(number.as_f64().unwrap()).to_owned()
        }
        _ => serde_json::to_string(value).unwrap(),
    }
}
