//! Decode package stylesheet entrypoints at the external JSON boundary.

use std::cmp::Reverse;
use std::iter;

use serde_json::Value;

use crate::resolution::Resolution;

pub(crate) struct Package {
    pub(crate) mains: Vec<String>,
    pub(crate) exports: Option<Target>,
}

pub(crate) enum Target {
    Path(String),
    Choices(Vec<Target>),
    Conditions(Vec<(String, Target)>),
    Invalid,
}

impl Package {
    pub(crate) fn parse(bytes: &[u8], settings: &Resolution) -> Option<Self> {
        let value: Value = serde_json::from_slice(bytes).ok()?;
        let fields = if settings.main_fields.is_empty() {
            vec!["style", "main", "module"]
        } else {
            iter::once("style")
                .chain(settings.main_fields.iter().map(String::as_str))
                .collect()
        };
        let mains = fields
            .into_iter()
            .filter_map(|field| value.get(field).and_then(Value::as_str).map(str::to_owned))
            .collect();
        let exports = value.get("exports").map(target);
        Some(Self { mains, exports })
    }
}

fn target(value: &Value) -> Target {
    match value {
        Value::String(path) => Target::Path(path.clone()),
        Value::Array(choices) => Target::Choices(choices.iter().map(target).collect()),
        Value::Object(conditions) => Target::Conditions(
            conditions
                .iter()
                .map(|(condition, value)| (condition.clone(), target(value)))
                .collect(),
        ),
        _ => Target::Invalid,
    }
}

impl Target {
    pub(crate) fn resolve(&self, subpath: &str, settings: &Resolution) -> Option<String> {
        match self {
            Self::Path(path) => (subpath == ".").then(|| path.clone()),
            Self::Choices(choices) => choices
                .iter()
                .find_map(|choice| choice.resolve(subpath, settings)),
            Self::Conditions(conditions)
                if conditions.iter().any(|(name, _)| name.starts_with('.')) =>
            {
                if let Some((_, target)) = conditions.iter().find(|(name, _)| name == subpath) {
                    return target.resolve(".", settings);
                }
                let mut patterns: Vec<_> = conditions
                    .iter()
                    .filter_map(|(pattern, target)| {
                        let (prefix, suffix) = pattern.split_once('*')?;
                        let capture = subpath.strip_prefix(prefix)?.strip_suffix(suffix)?;
                        Some((prefix.len(), suffix.len(), capture, target))
                    })
                    .collect();
                patterns.sort_by_key(|(prefix, suffix, _, _)| (Reverse(*prefix), Reverse(*suffix)));
                patterns.first().and_then(|(_, _, capture, target)| {
                    target
                        .resolve(".", settings)
                        .map(|path| path.replace('*', capture))
                })
            }
            Self::Conditions(conditions) => conditions.iter().find_map(|(condition, target)| {
                (condition == "style"
                    || condition == "default"
                    || condition == "node"
                    || condition == "import"
                    || settings.conditions.contains(condition))
                .then(|| target.resolve(subpath, settings))
                .flatten()
            }),
            Self::Invalid => None,
        }
    }
}
