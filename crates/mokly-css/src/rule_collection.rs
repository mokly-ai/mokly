//! Collect complete rule lists with lightningcss validation and selector serialization.

use lightningcss::rules::CssRule;
use lightningcss::stylesheet::{ParserOptions, PrinterOptions, StyleSheet};
use lightningcss::traits::ToCss;

use crate::css_boundaries;
use crate::rule_syntax::{normalize, opaque, parts};
use crate::rules::{AtRule, Condition, ConditionKind, ParsedCss, Rule};
use crate::syntax;

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
    match walk(&source, &[], None, &mut output) {
        Ok(()) => ParsedCss::Rules(output),
        Err(cause) => ParsedCss::Failed(cause),
    }
}

fn walk(
    source: &str,
    conditions: &[Condition],
    parent: Option<&[String]>,
    output: &mut Vec<Rule>,
) -> Result<(), String> {
    let sections = parts(source)?;
    let mut declarations = Vec::new();
    let mut after_nested = false;
    for section in sections {
        let prelude = section.prelude.trim();
        let normalized = normalize(prelude);
        if normalized.is_empty() {
            continue;
        }
        if section.body.is_none() && !normalized.starts_with('@') && parent.is_some() {
            declarations.push(normalized);
            continue;
        }
        flush(&mut declarations, conditions, parent, after_nested, output);
        after_nested = parent.is_some();
        if let Some(at) = normalized.strip_prefix('@') {
            let name_end = at
                .find(|c: char| c.is_ascii_whitespace() || matches!(c, '(' | '"' | '\''))
                .unwrap_or(at.len());
            let name = at[..name_end].to_ascii_lowercase();
            let rest = at[name_end..].trim().to_owned();
            if let Some(body) = section.body
                && matches!(name.as_str(), "media" | "container" | "supports" | "layer")
                && !normalize(body).is_empty()
            {
                let mut nested = conditions.to_vec();
                if let Some(parent) = parent {
                    nested.push(Condition {
                        kind: ConditionKind::NestingParent,
                        prelude: parent.join(", "),
                    });
                    nested.push(Condition {
                        kind: match name.as_str() {
                            "media" => ConditionKind::Media,
                            "container" => ConditionKind::Container,
                            "supports" => ConditionKind::Supports,
                            _ => ConditionKind::Layer,
                        },
                        prelude: rest,
                    });
                    walk(body, &nested, Some(&["&".into()]), output)?;
                } else {
                    nested.push(Condition {
                        kind: match name.as_str() {
                            "media" => ConditionKind::Media,
                            "container" => ConditionKind::Container,
                            "supports" => ConditionKind::Supports,
                            _ => ConditionKind::Layer,
                        },
                        prelude: rest,
                    });
                    walk(body, &nested, None, output)?;
                }
            } else {
                push(
                    Vec::new(),
                    section.body.map_or_else(String::new, opaque),
                    conditions,
                    Some(AtRule {
                        name,
                        prelude: rest,
                    }),
                    output,
                );
            }
        } else if let Some(body) = section.body {
            let selectors = selectors(prelude, parent.is_some())?;
            let mut nested = conditions.to_vec();
            if let Some(parent) = parent {
                nested.push(Condition {
                    kind: ConditionKind::NestingParent,
                    prelude: parent.join(", "),
                });
            }
            let start = output.len();
            walk(body, &nested, Some(&selectors), output)?;
            if start == output.len() {
                push(selectors, String::new(), &nested, None, output);
            }
        } else {
            return Err("expected a rule block".into());
        }
    }
    flush(&mut declarations, conditions, parent, after_nested, output);
    Ok(())
}

fn flush(
    declarations: &mut Vec<String>,
    conditions: &[Condition],
    parent: Option<&[String]>,
    after_nested: bool,
    output: &mut Vec<Rule>,
) {
    if declarations.is_empty() {
        return;
    }
    let mut conditions = conditions.to_vec();
    let selectors = if after_nested {
        conditions.push(Condition {
            kind: ConditionKind::NestingParent,
            prelude: parent.unwrap_or_default().join(", "),
        });
        vec!["&".into()]
    } else {
        parent.unwrap_or_default().to_vec()
    };
    let declarations = std::mem::take(declarations).join(";");
    push(selectors, declarations, &conditions, None, output);
}

fn push(
    selectors: Vec<String>,
    declarations: String,
    conditions: &[Condition],
    at_rule: Option<AtRule>,
    output: &mut Vec<Rule>,
) {
    let custom = parts(&declarations)
        .unwrap_or_default()
        .iter()
        .filter_map(|part| {
            let declaration = normalize(part.prelude);
            declaration.starts_with("--").then_some(declaration)
        })
        .collect();
    let mut references: Vec<_> = syntax::references(&declarations)
        .into_iter()
        .map(|reference| reference.value)
        .collect();
    for condition in conditions {
        references.extend(
            syntax::references(&condition.prelude)
                .into_iter()
                .map(|reference| reference.value),
        );
    }
    if let Some(at_rule) = &at_rule {
        references.extend(
            syntax::references(&format!("@{} {};", at_rule.name, at_rule.prelude))
                .into_iter()
                .map(|reference| reference.value),
        );
    }
    output.push(Rule {
        ordinal: output.len(),
        selectors,
        declarations,
        conditions: conditions.to_vec(),
        at_rule,
        custom,
        references,
    });
}

fn selectors(source: &str, nested: bool) -> Result<Vec<String>, String> {
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
