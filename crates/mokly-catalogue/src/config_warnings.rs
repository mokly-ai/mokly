//! Configuration-level migration warnings are emitted once during preparation.

use crate::config::relative;
use crate::config_types::{Config, ResolvedConfig};
use crate::diagnostic::{Warning, WarningSubject, json_quoted};

/// Warn about unsupported stylesheet matchers and settings replaced by Vite.
pub(crate) fn collect(config: &ResolvedConfig) -> Vec<Warning> {
    let path = if config.file.starts_with(&config.repo_root) {
        relative(&config.file, &config.repo_root)
    } else {
        config.file.file_name().map_or_else(
            || "mokly.config.json".into(),
            |name| name.to_string_lossy().into_owned(),
        )
    };
    let subject = WarningSubject::Configuration(path);
    let mut warnings: Vec<_> = config.input.stylesheets.iter().flatten()
        .filter(|rule| has_extglob(&rule.r#match))
        .map(|rule| Warning {
            code: "stylesheet-extglob",
            subject: subject.clone(),
            message: format!(
                "stylesheet match {} uses unsupported extglob syntax. Use brace alternatives such as \"{{a,b}}\" instead.",
                json_quoted(&rule.r#match)
            ),
        })
        .collect();
    if config.vite() {
        collect_vite_replaced_settings(&config.input, &subject, &mut warnings);
    }
    warnings
}

fn collect_vite_replaced_settings(
    config: &Config,
    subject: &WarningSubject,
    warnings: &mut Vec<Warning>,
) {
    let warning = |message| Warning {
        code: "vite-replaced-setting",
        subject: subject.clone(),
        message,
    };
    let resolution = config.module_resolution.as_ref();
    for (field, present) in [
        ("postcss", config.postcss.is_some()),
        (
            "moduleResolution.aliases",
            resolution.is_some_and(|module| module.aliases.is_some()),
        ),
        (
            "moduleResolution.conditions",
            resolution.is_some_and(|module| module.conditions.is_some()),
        ),
        (
            "moduleResolution.mainFields",
            resolution.is_some_and(|module| module.main_fields.is_some()),
        ),
        (
            "moduleResolution.resolveExtensions",
            resolution.is_some_and(|module| module.resolve_extensions.is_some()),
        ),
    ] {
        if present {
            warnings.push(warning(format!(
                "setting \"{field}\" has no effect under the Vite adapter, because the Vite setup replaces it. Remove it, or move it to the Vite setup."
            )));
        }
    }

    let Some(loaders) = resolution.and_then(|module| module.loaders.as_ref()) else {
        return;
    };
    let keys = loaders
        .keys()
        .map(String::as_str)
        .filter(|key| !matches!(*key, ".css" | ".module.css"))
        .map(json_quoted)
        .collect::<Vec<_>>()
        .join(", ");
    if !keys.is_empty() {
        warnings.push(warning(format!(
            "setting \"moduleResolution.loaders\" has no effect under the Vite adapter for keys {keys}, because the Vite setup replaces them. Remove those keys, or move them to the Vite setup."
        )));
    }
}

fn has_extglob(pattern: &str) -> bool {
    let mut characters = pattern.chars().peekable();
    while let Some(character) = characters.next() {
        match character {
            '[' => {
                if characters
                    .peek()
                    .is_some_and(|next| matches!(next, '!' | '^'))
                {
                    characters.next();
                }
                if characters.peek() == Some(&']') {
                    characters.next();
                }
                for next in characters.by_ref() {
                    if next == ']' {
                        break;
                    }
                }
            }
            '@' | '!' | '+' | '*' | '?' if characters.peek() == Some(&'(') => return true,
            _ => {}
        }
    }
    false
}
