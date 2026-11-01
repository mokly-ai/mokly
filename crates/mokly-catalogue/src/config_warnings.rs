//! Configuration-level migration warnings are emitted once during preparation.

use crate::config::relative;
use crate::config_types::ResolvedConfig;
use crate::diagnostic::{Warning, WarningSubject, json_quoted};

/// Warn about extglob-shaped matchers without changing their globset meaning.
pub(crate) fn collect(config: &ResolvedConfig) -> Vec<Warning> {
    let path = if config.file.starts_with(&config.repo_root) {
        relative(&config.file, &config.repo_root)
    } else {
        config.file.file_name().map_or_else(
            || "mokly.config.json".into(),
            |name| name.to_string_lossy().into_owned(),
        )
    };
    config.input.stylesheets.iter().flatten()
        .filter(|rule| has_extglob(&rule.r#match))
        .map(|rule| Warning {
            code: "stylesheet-extglob",
            subject: WarningSubject::Configuration(path.clone()),
            message: format!(
                "stylesheet match {} uses unsupported extglob syntax. Use brace alternatives such as \"{{a,b}}\" instead.",
                json_quoted(&rule.r#match)
            ),
        })
        .collect()
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
