//! Both interface palettes of `examples/basic/design.css` and the WCAG
//! contrast ratio of two opaque colours.

use regex::Regex;

use crate::support::read_text;

/// One palette: token names and values in declaration order.
pub(crate) struct Tokens(Vec<(String, String)>);

impl Tokens {
    /// The value of a token.
    pub(crate) fn get(&self, name: &str) -> Option<&str> {
        self.0
            .iter()
            .find(|(token, _)| token == name)
            .map(|(_, value)| value.as_str())
    }

    /// The tokens and their values in declaration order.
    pub(crate) fn iter(&self) -> impl Iterator<Item = (&str, &str)> {
        self.0
            .iter()
            .map(|(token, value)| (token.as_str(), value.as_str()))
    }

    /// The token names in declaration order.
    pub(crate) fn names(&self) -> impl Iterator<Item = &str> {
        self.iter().map(|(token, _)| token)
    }

    /// Set a token, keeping the position of an earlier declaration.
    fn set(&mut self, name: &str, value: String) {
        match self.0.iter_mut().find(|(token, _)| token == name) {
            Some(entry) => entry.1 = value,
            None => self.0.push((name.to_owned(), value)),
        }
    }
}

/// The light and dark interface palettes.
pub(crate) struct Palette {
    /// The `light` appearance.
    pub(crate) light: Tokens,
    /// The `dark` appearance.
    pub(crate) dark: Tokens,
}

impl Palette {
    /// Both appearances with their names, light first.
    pub(crate) fn appearances(&self) -> [(&'static str, &Tokens); 2] {
        [("light", &self.light), ("dark", &self.dark)]
    }
}

/// Both palettes exactly as the shared design stylesheet declares them.
pub(crate) fn design_palette() -> Palette {
    let source = read_text("examples/basic/design.css");
    let block = |appearance: &str| {
        let pattern = format!(r#"\[data-mbk-appearance="{appearance}"\]\s*\{{([^}}]*)\}}"#);
        Regex::new(&pattern)
            .unwrap()
            .captures(&source)
            .map(|block| block[1].to_owned())
            .filter(|block| !block.is_empty())
            .expect("design.css is missing a palette block")
    };
    Palette {
        light: read_tokens(&block("light")),
        dark: read_tokens(&block("dark")),
    }
}

/// WCAG contrast ratio, truncated to the two decimals the contract records.
pub(crate) fn contrast(foreground: &str, background: &str) -> f64 {
    let first = luminance(foreground);
    let second = luminance(background);
    let ratio = (first.max(second) + 0.05) / (first.min(second) + 0.05);
    (ratio * 100.0).floor() / 100.0
}

fn read_tokens(block: &str) -> Tokens {
    let declaration = Regex::new(r"(--[a-z0-9-]+)\s*:\s*([^;]+);").unwrap();
    let whitespace = Regex::new(r"\s+").unwrap();
    let mut tokens = Tokens(Vec::new());
    for found in declaration.captures_iter(block) {
        let value = whitespace.replace_all(&found[2], " ").trim().to_owned();
        tokens.set(&found[1], value);
    }
    tokens
}

fn channel(value: u8) -> f64 {
    let ratio = f64::from(value) / 255.0;
    if ratio <= 0.04045 {
        ratio / 12.92
    } else {
        ((ratio + 0.055) / 1.055).powf(2.4)
    }
}

/// Relative luminance of an opaque `#rgb` or `#rrggbb` colour.
fn luminance(color: &str) -> f64 {
    let hex = color.trim().replacen('#', "", 1);
    let full: String = if hex.chars().count() == 3 {
        hex.chars().flat_map(|digit| [digit, digit]).collect()
    } else {
        hex
    };
    let opaque = Regex::new(r"^[0-9a-fA-F]{6}$").unwrap();
    assert!(opaque.is_match(&full), "not an opaque colour: {color}");
    let part = |start: usize| channel(u8::from_str_radix(&full[start..start + 2], 16).unwrap());
    0.2126 * part(0) + 0.7152 * part(2) + 0.0722 * part(4)
}
