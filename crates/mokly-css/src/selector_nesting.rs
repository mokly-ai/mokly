//! Replace nesting tokens without changing literal strings or attribute values.

use cssparser_next::Token;

use crate::selector_tokens::{NESTED_BLOCK_LIMIT, tokenize};

pub(crate) fn combine(selector: &str, parent: Option<&str>) -> Option<String> {
    let Some(parent) = parent else {
        return Some(selector.into());
    };
    let mut edits = Vec::new();
    positions(selector, &mut edits)?;
    let parent = format!(":is({parent})");
    if edits.is_empty() {
        return Some(format!("{parent} {selector}"));
    }
    let mut result = selector.to_owned();
    for (start, end) in edits.into_iter().rev() {
        result.get(start..end)?;
        result.replace_range(start..end, &parent);
    }
    Some(result)
}

fn positions(source: &str, output: &mut Vec<(usize, usize)>) -> Option<()> {
    let tokens = tokenize(source);
    let mut pending = vec![(tokens.root(), 0)];
    while let Some((mut range, depth)) = pending.pop() {
        let Some(index) = tokens.next(&mut range) else {
            continue;
        };
        let node = &tokens.nodes[index];
        pending.push((range, depth));
        match node.token {
            Token::Delim('&') => output.push((node.start, node.end)),
            Token::Function(_) | Token::ParenthesisBlock => {
                if depth == NESTED_BLOCK_LIMIT {
                    return None;
                }
                pending.push((tokens.children(index), depth + 1));
            }
            Token::SquareBracketBlock if depth == NESTED_BLOCK_LIMIT => return None,
            _ => {}
        }
    }
    Some(())
}
