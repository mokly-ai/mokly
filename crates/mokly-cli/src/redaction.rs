//! Token redaction and terminal control escaping before presentation.

use mokly_publish::redaction::SecretMatcher;

/// Secrets collected before parsing, so rejected arguments are also protected.
#[derive(Default)]
pub struct Redactor {
    secrets: Vec<SecretMatcher>,
}

impl Redactor {
    /// Collect environment and argument token values, including malformed options.
    pub fn collect(args: &[String], token: Option<&str>) -> Self {
        let mut secrets = Vec::new();
        if let Some(token) = token.filter(|token| !token.is_empty()) {
            secrets.push(SecretMatcher::new(token));
        }
        for (index, argument) in args.iter().enumerate() {
            if let Some(value) = argument.strip_prefix("--token=") {
                if !value.is_empty() {
                    secrets.push(SecretMatcher::new(value));
                }
            } else if argument == "--token"
                && let Some(value) = args.get(index + 1)
                && !value.is_empty()
            {
                secrets.push(SecretMatcher::new(value));
            }
        }
        secrets.sort_by_key(|secret| std::cmp::Reverse(secret.len()));
        Self { secrets }
    }

    /// Redact literal and encodeURIComponent forms, then escape unsafe controls.
    pub fn safe(&self, text: &str) -> String {
        self.clean(text, false)
    }

    /// Keep structural diagnostic line breaks while escaping each line's controls.
    pub(crate) fn safe_lines(&self, text: &str) -> String {
        self.clean(text, true)
    }

    fn clean(&self, text: &str, lines: bool) -> String {
        let mut safe = text.to_owned();
        for secret in &self.secrets {
            safe = secret.redact(&safe);
        }
        if !safe
            .chars()
            .any(|character| character.is_control() && !(lines && character == '\n'))
        {
            return safe;
        }
        let mut output = String::with_capacity(safe.len());
        for character in safe.chars() {
            if character.is_control() && !(lines && character == '\n') {
                output.push_str(&format!("\\u{:04x}", character as u32));
            } else {
                output.push(character);
            }
        }
        output
    }
}

#[cfg(test)]
#[path = "_tests_/redaction_tests.rs"]
mod redaction_tests;
