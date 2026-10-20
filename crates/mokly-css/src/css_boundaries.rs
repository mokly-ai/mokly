//! Ignore CSS's top-level HTML boundary tokens without touching nested or quoted text.

use cssparser::Token;

use crate::token_tree::Tokens;

pub(crate) fn strip(source: &str) -> String {
    let tokens = Tokens::new(source);
    let mut range = tokens.root();
    let mut edits = Vec::new();
    while let Some(index) = tokens.next(&mut range) {
        let node = &tokens.nodes[index];
        if matches!(node.token, Token::CDO | Token::CDC) {
            edits.push((node.start, node.end));
        }
    }
    let mut output = source.to_owned();
    for (start, end) in edits.into_iter().rev() {
        if output.get(start..end).is_some() {
            output.replace_range(start..end, "");
        }
    }
    output
}
