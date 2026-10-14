//! Token redaction and terminal control escaping before presentation.

/// Secrets collected before parsing, so rejected arguments are also protected.
#[derive(Default)]
pub struct Redactor {
    secrets: Vec<String>,
}

impl Redactor {
    /// Collect environment and argument token values, including malformed options.
    pub fn collect(args: &[String], token: Option<&str>) -> Self {
        let mut secrets = Vec::new();
        if let Some(token) = token.filter(|token| !token.is_empty()) {
            secrets.push(token.to_owned());
        }
        for (index, argument) in args.iter().enumerate() {
            if let Some(value) = argument.strip_prefix("--token=") {
                if !value.is_empty() {
                    secrets.push(value.to_owned());
                }
            } else if argument == "--token"
                && let Some(value) = args.get(index + 1)
                && !value.is_empty()
            {
                secrets.push(value.clone());
            }
        }
        let encoded: Vec<_> = secrets
            .iter()
            .map(|secret| encode_component(secret))
            .collect();
        secrets.extend(encoded);
        secrets.sort_by_key(|secret| std::cmp::Reverse(secret.len()));
        secrets.dedup();
        Self { secrets }
    }

    /// Redact literal and encodeURIComponent forms, then escape unsafe controls.
    pub fn safe(&self, text: &str) -> String {
        let mut safe = text.to_owned();
        for secret in &self.secrets {
            safe = safe.replace(secret, "[redacted]");
        }
        safe.chars()
            .map(|character| {
                if character.is_control() {
                    format!("\\u{:04x}", character as u32)
                } else {
                    character.to_string()
                }
            })
            .collect()
    }
}

fn encode_component(value: &str) -> String {
    value
        .bytes()
        .map(|byte| {
            if byte.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&byte) {
                (byte as char).to_string()
            } else {
                format!("%{byte:02X}")
            }
        })
        .collect()
}
