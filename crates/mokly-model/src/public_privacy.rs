//! Inspect original receiver JSON before unknown extensions disappear during decoding.

use serde_json::Value;

use crate::read_contract::ContractViolation;
use crate::readers::ReadError;

const PRIVATE_KEYS: &[&str] = &[
    "dependencies",
    "sourceFiles",
    "movedFrom",
    "declaredDependencies",
    "ownedDependencies",
    "startOffset",
    "endOffset",
    "styles",
    "resources",
    "manifest",
    "baseline",
    "changedPaths",
    "headDigests",
    "sourceGraph",
    "renderCapability",
    "resolvedDependencies",
    "dependencyEvidence",
    "baselineManifest",
    "sourceMaps",
    "gitCommands",
    "styleOwnership",
    "resourceOwnership",
    "credentials",
    "token",
    "authorization",
    "cookies",
];

struct Visit<'a> {
    value: &'a Value,
    depth: usize,
    data: bool,
    parent: Option<&'a str>,
}

pub(crate) fn validate(value: &Value, boundary: &'static str) -> Result<(), ReadError> {
    let index = boundary == "catalogue index";
    let mut pending = vec![Visit {
        value,
        depth: 0,
        data: false,
        parent: None,
    }];
    let mut nodes = 0;
    while let Some(Visit {
        value,
        depth,
        data,
        parent,
    }) = pending.pop()
    {
        nodes += 1;
        if nodes > 5_000_000 || depth > 128 {
            return Err(invalid(boundary, ContractViolation::PublicDataLimit));
        }
        match value {
            Value::Array(items) => {
                pending.extend(items.iter().map(|value| Visit {
                    value,
                    depth: depth + 1,
                    data,
                    parent,
                }));
            }
            Value::Object(record) => {
                for (key, child) in record {
                    if !data {
                        let private = PRIVATE_KEYS.contains(&key.as_str())
                            && !(key == "resources"
                                && !index
                                && parent == Some("resourceEvidence"));
                        if private
                            || (index && matches!(key.as_str(), "usage" | "resourceEvidence"))
                        {
                            return Err(invalid(boundary, ContractViolation::PrivateField));
                        }
                        if (key == "path" || key.ends_with("Path"))
                            && let Some(path) = child.as_str()
                            && !relative(path)
                        {
                            return Err(invalid(boundary, ContractViolation::PublicPath));
                        }
                        if matches!(key.as_str(), "properties" | "controls")
                            && let Some(map) = child.as_object()
                        {
                            pending.extend(map.values().map(|value| Visit {
                                value,
                                depth: depth + 1,
                                data: false,
                                parent: None,
                            }));
                            continue;
                        }
                    }
                    pending.push(Visit {
                        value: child,
                        depth: depth + 1,
                        data: data || matches!(key.as_str(), "props" | "before" | "after"),
                        parent: Some(key),
                    });
                }
            }
            _ => {}
        }
    }
    Ok(())
}

fn relative(path: &str) -> bool {
    !path.trim().is_empty()
        && !path.starts_with('/')
        && !path.contains(['\\', ':', '\0'])
        && path.split('/').all(|part| !matches!(part, "" | "." | ".."))
}

fn invalid(boundary: &'static str, message: ContractViolation) -> ReadError {
    ReadError::Contract { boundary, message }
}
