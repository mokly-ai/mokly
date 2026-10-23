//! A token consumer cannot recover ignored values, but diagnostics retain their evidence.

use html5gum::{Error, Token};

use crate::html_tokens;

#[test]
fn new_token_consumers_cannot_read_unknown_ignore_attributes() {
    for (wrapper, required, key, value) in [
        ("mokly-ignore", "id='clock'", "id", "clock"),
        ("mokly-ignore-scope", "enabled='true'", "enabled", "true"),
    ] {
        let source = format!(
            "<{wrapper} {required} mokly-if='$visible' mokly-viewport='mobile' class='hidden' href='mock:missing' slot='missing' title='{{{{absent}}}}'><span class='kept'>Text</span></{wrapper}>"
        );
        let mut tokens = html_tokens::parse(&source);
        let parsed = tokens.next().unwrap();
        let Token::StartTag(tag) = parsed.token else {
            panic!("expected the ignore wrapper");
        };
        let attributes: Vec<_> = tag
            .attributes
            .iter()
            .map(|(name, value)| {
                (
                    String::from_utf8_lossy(name).into_owned(),
                    String::from_utf8_lossy(&value.value).into_owned(),
                )
            })
            .collect();
        assert_eq!(
            attributes,
            [
                (key.into(), value.into()),
                ("mokly-if".into(), "$visible".into()),
                ("mokly-viewport".into(), "mobile".into()),
            ],
            "the parsing boundary hides unknown attributes on {wrapper}"
        );
        assert_eq!(
            parsed.ignored_attributes,
            ["class", "href", "slot", "title"]
        );
        assert!(!parsed.reserved_navigation);
        let nested = tokens.next().unwrap();
        let Token::StartTag(tag) = nested.token else {
            panic!("expected the ordinary child");
        };
        assert_eq!(
            tag.attributes
                .get(b"class".as_slice())
                .unwrap()
                .value
                .as_ref(),
            b"kept"
        );
        assert!(nested.ignored_attributes.is_empty());
    }
}

#[test]
fn reserved_navigation_evidence_survives_unknown_attribute_removal() {
    for name in ["data-mokly-link", "data-mokly-link-control-future"] {
        let source = format!("<mokly-ignore id='clock' {name}='{{{{absent}}}}'></mokly-ignore>");
        let parsed = html_tokens::parse(&source).next().unwrap();
        assert!(parsed.reserved_navigation);
        let Token::StartTag(tag) = parsed.token else {
            panic!("expected the ignore wrapper");
        };
        assert!(!tag.attributes.contains_key(name.as_bytes()));
        assert_eq!(parsed.ignored_attributes, [name]);
    }
}

#[test]
fn duplicate_navigation_errors_keep_the_original_source_span() {
    for attribute in ["href", "data-nav-href", "data-mokly-target"] {
        let duplicate = attribute.to_ascii_uppercase();
        let source = format!(
            "<mokly-ignore id='clock' {attribute}='first' {duplicate}='second'></mokly-ignore>"
        );
        let names: Vec<_> = html_tokens::parse(&source)
            .filter_map(|parsed| match parsed.token {
                Token::Error(error) if error.value == Error::DuplicateAttribute => {
                    Some(source[error.span.start..error.span.end].to_owned())
                }
                _ => None,
            })
            .collect();
        assert_eq!(names, [duplicate]);
    }
}

#[test]
fn raw_text_that_looks_like_a_wrapper_is_not_filtered() {
    let literal = "\"<mokly-ignore class='literal'>\"";
    let source = format!("<script>{literal}</script>");
    let tokens: Vec<_> = html_tokens::parse(&source).collect();
    assert!(
        tokens
            .iter()
            .all(|token| token.ignored_attributes.is_empty())
    );
    let text: String = tokens
        .into_iter()
        .filter_map(|token| match token.token {
            Token::String(text) => Some(String::from_utf8_lossy(&text.value).into_owned()),
            _ => None,
        })
        .collect();
    assert_eq!(text, literal);
}

#[test]
fn markup_contexts_keep_wrappers_visible_to_catalogue_checks() {
    for source in [
        "<noscript><mokly-ignore-scope enabled='true' typo='x'>A</mokly-ignore-scope></noscript>",
        "<svg><style><mokly-ignore-scope enabled='true' typo='x'>A</mokly-ignore-scope></style></svg>",
        "<math><title><mokly-ignore-scope enabled='true' typo='x'>A</mokly-ignore-scope></title></math>",
    ] {
        let wrappers: Vec<_> = html_tokens::parse(source)
            .filter_map(|parsed| match parsed.token {
                Token::StartTag(tag) if tag.name.as_ref() == b"mokly-ignore-scope" => {
                    Some(parsed.ignored_attributes)
                }
                _ => None,
            })
            .collect();
        assert_eq!(wrappers, vec![vec!["typo".to_owned()]], "{source}");
    }
}

#[test]
fn markup_context_tracker_keeps_tree_raw_text_and_integration_points() {
    for source in [
        "<svg><title>&lt;x-card&gt;</title></svg>",
        "<noscript><style><mokly-ignore-scope typo='x'>A</mokly-ignore-scope></style></noscript>",
        "<svg/><style><mokly-ignore-scope typo='x'>A</mokly-ignore-scope></style>",
        "<svg><foreignObject><style><mokly-ignore-scope typo='x'>A</mokly-ignore-scope></style></foreignObject></svg>",
        "<svg><foreignObject><div></div><style><mokly-ignore-scope typo='x'>A</mokly-ignore-scope></style></foreignObject></svg>",
    ] {
        let wrappers: Vec<_> = html_tokens::parse(source)
            .filter_map(|parsed| match parsed.token {
                Token::StartTag(tag) if tag.name.as_ref() == b"mokly-ignore-scope" => {
                    Some(parsed.ignored_attributes)
                }
                _ => None,
            })
            .collect();
        assert!(wrappers.is_empty(), "{source}");
    }
}

#[test]
fn foreign_and_noframes_raw_text_matches_the_tree_parser() {
    for source in [
        "<noframes><mokly-ignore-scope typo='x'>A</mokly-ignore-scope></noframes>",
        "<svg><script><mokly-ignore-scope typo='x'>A</mokly-ignore-scope></script></svg>",
        "<svg><textarea><mokly-ignore-scope typo='x'>A</mokly-ignore-scope></textarea></svg>",
        "<svg><foreignObject><title><mokly-ignore-scope typo='x'>A</mokly-ignore-scope></title></foreignObject></svg>",
    ] {
        let wrappers: Vec<_> = html_tokens::parse(source)
            .filter_map(|parsed| match parsed.token {
                Token::StartTag(tag) if tag.name.as_ref() == b"mokly-ignore-scope" => {
                    Some(parsed.ignored_attributes)
                }
                _ => None,
            })
            .collect();
        assert!(wrappers.is_empty(), "{source}");
    }
}
