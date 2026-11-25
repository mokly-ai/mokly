//! Lower Storybook extglobs into ordinary root patterns.

use std::collections::BTreeSet;
use std::iter::Peekable;
use std::str::Chars;

use crate::globs;

const OMITTED: char = '\0';

pub(crate) fn patterns(pattern: &str) -> Result<Vec<String>, String> {
    globs::validate(pattern)?;
    let alternatives: BTreeSet<_> = expand(&mut pattern.chars().peekable(), false)?
        .into_iter()
        // Omitting a complete path segment can only match a path with an empty segment.
        .filter(|pattern| {
            !pattern.split('/').any(|segment| {
                !segment.is_empty() && segment.chars().all(|character| character == OMITTED)
            })
        })
        .map(|pattern| pattern.replace(OMITTED, ""))
        .collect();
    let patterns: Vec<_> = alternatives.into_iter().collect();
    globs::compile(&patterns)?;
    Ok(patterns)
}

fn expand(chars: &mut Peekable<Chars<'_>>, group: bool) -> Result<Vec<String>, String> {
    let mut branches = vec![String::new()];
    let mut alternatives = Vec::new();
    let mut braces = 0usize;
    let mut parentheses = 0usize;
    let mut class = false;
    while let Some(character) = chars.next() {
        if class {
            class = character != ']';
        } else {
            match character {
                '@' | '?' | '*' | '+' | '!' if chars.peek() == Some(&'(') => {
                    if matches!(character, '*' | '+' | '!') {
                        return Err(format!("unsupported extglob {character}(...)"));
                    }
                    chars.next();
                    let mut suffixes = expand(chars, true)?;
                    if character == '?' {
                        suffixes.push(OMITTED.to_string());
                    }
                    branches = branches
                        .iter()
                        .flat_map(|prefix| {
                            suffixes
                                .iter()
                                .map(move |suffix| format!("{prefix}{suffix}"))
                        })
                        .collect();
                    continue;
                }
                '[' => class = true,
                '{' => braces += 1,
                '}' => braces = braces.saturating_sub(1),
                '(' if group => parentheses += 1,
                ')' if group && parentheses == 0 && braces == 0 => {
                    alternatives.extend(branches);
                    return Ok(alternatives);
                }
                ')' => parentheses = parentheses.saturating_sub(1),
                '|' if group && parentheses == 0 && braces == 0 => {
                    alternatives.append(&mut branches);
                    branches.push(String::new());
                    continue;
                }
                _ => {}
            }
        }
        for branch in &mut branches {
            branch.push(character);
        }
    }
    if group {
        Err("unclosed extglob".into())
    } else {
        Ok(branches)
    }
}
