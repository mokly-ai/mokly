//! Collect complete rule lists with lightningcss validation and selector serialization.

use lightningcss::rules::CssRule;
use lightningcss::stylesheet::{ParserOptions, PrinterOptions, StyleSheet};
use lightningcss::traits::ToCss;

use crate::css_boundaries;
use crate::rule_syntax::parts;
use crate::rule_walk::walk;
use crate::rules::ParsedCss;

/// Parse without browser recovery. A failed sheet supplies no partial evidence.
pub fn collect(source: &[u8]) -> ParsedCss {
    let Ok(source) = str::from_utf8(source) else {
        return ParsedCss::Failed("stylesheet is not UTF-8".into());
    };
    let source = source.strip_prefix('\u{feff}').unwrap_or(source);
    if let Err(cause) = parts(source) {
        return ParsedCss::Failed(cause.into());
    }
    if let Err(cause) = StyleSheet::parse(source, ParserOptions::default()) {
        return ParsedCss::Failed(cause.to_string());
    }
    let source = css_boundaries::strip(source);
    let mut output = Vec::new();
    match walk(&source, &mut output) {
        Ok(()) => ParsedCss::Rules(output),
        Err(cause) => ParsedCss::Failed(cause),
    }
}

pub(crate) fn selectors(source: &str, nested: bool) -> Result<Vec<String>, String> {
    let wrapped = if nested {
        format!(".mokly-parent {{ {source} {{}} }}")
    } else {
        format!("{source} {{}}")
    };
    let sheet = match StyleSheet::parse(&wrapped, ParserOptions::default()) {
        Ok(sheet) => sheet,
        Err(cause) => return Err(cause.to_string()),
    };
    let Some(CssRule::Style(style)) = sheet.rules.0.first() else {
        return Err("expected a style rule".into());
    };
    let style = if nested {
        let Some(CssRule::Style(style)) = style.rules.0.first() else {
            return Err("expected a nested style rule".into());
        };
        style
    } else {
        style
    };
    style
        .selectors
        .0
        .iter()
        .map(
            |selector| match selector.to_css_string(PrinterOptions::default()) {
                Ok(text) => Ok(text),
                Err(cause) => Err(cause.to_string()),
            },
        )
        .collect()
}
