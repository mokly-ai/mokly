//! A token consumer cannot recover ignored values, but diagnostics retain their evidence.

use crate::html_tokens::{self, Error, ParsedToken, Token};
use crate::template_types::Template;

fn authored(source: &str) -> Vec<ParsedToken> {
    let template = Template {
        source_path: "specs/example.html".into(),
        source: source.into(),
        body: source.into(),
        body_offset: 0,
        page: false,
    };
    html_tokens::parse(template.html()).collect()
}

#[test]
fn new_token_consumers_cannot_read_unknown_ignore_attributes() {
    for (wrapper, required, key, value) in [
        ("mokly-ignore", "id='clock'", "id", "clock"),
        ("mokly-ignore-scope", "enabled='true'", "enabled", "true"),
    ] {
        let source = format!(
            "<{wrapper} {required} mokly-if='$visible' mokly-viewport='mobile' class='hidden' href='mock:missing' slot='missing' title='{{{{absent}}}}'><span class='kept'>Text</span></{wrapper}>"
        );
        let mut tokens = authored(&source).into_iter();
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
                .as_slice(),
            b"kept"
        );
        assert!(nested.ignored_attributes.is_empty());
    }
}

#[test]
fn reserved_navigation_evidence_survives_unknown_attribute_removal() {
    for name in ["data-mokly-link", "data-mokly-link-control-future"] {
        let source = format!("<mokly-ignore id='clock' {name}='{{{{absent}}}}'></mokly-ignore>");
        let parsed = authored(&source).into_iter().next().unwrap();
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
        let names: Vec<_> = authored(&source)
            .into_iter()
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
    let tokens = authored(&source);
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

fn wrapper_warnings(source: &str) -> Vec<Vec<String>> {
    authored(source)
        .into_iter()
        .filter_map(|parsed| match parsed.token {
            Token::StartTag(tag) if tag.name.as_slice() == b"mokly-ignore-scope" => {
                Some(parsed.ignored_attributes)
            }
            _ => None,
        })
        .collect()
}

#[test]
fn tree_markup_keeps_wrappers_visible_to_catalogue_checks() {
    for context in [
        "<noscript>{}</noscript>",
        "<svg><style>{}</style></svg>",
        "<math><title>{}</title></math>",
        "<svg><script>{}</script></svg>",
        "<svg><textarea>{}</textarea></svg>",
        "<math><annotation-xml><style>{}</style></annotation-xml></math>",
    ] {
        let source = context.replace(
            "{}",
            "<mokly-ignore-scope enabled='true' typo='x'>A</mokly-ignore-scope>",
        );
        assert_eq!(
            wrapper_warnings(&source),
            vec![vec!["typo".to_owned()]],
            "{source}"
        );
    }
}

#[test]
fn tree_raw_text_hides_wrappers_from_catalogue_checks() {
    for context in [
        "<noscript><style>{}</style></noscript>",
        "<svg/><style>{}</style>",
        "<svg><foreignObject><style>{}</style></foreignObject></svg>",
        "<svg><foreignObject><div></div><style>{}</style></foreignObject></svg>",
        "<svg><foreignObject><title>{}</title></foreignObject></svg>",
        "<noframes>{}</noframes>",
        "<svg><desc><style>{}</style></desc></svg>",
        "<svg><title><style>{}</style></title></svg>",
        "<math><annotation-xml encoding='text/html'><style>{}</style></annotation-xml></math>",
        "<math><annotation-xml encoding='Application/XHTML+XML'><style>{}</style></annotation-xml></math>",
    ] {
        let source = context.replace("{}", "<mokly-ignore-scope typo='x'>A</mokly-ignore-scope>");
        assert!(wrapper_warnings(&source).is_empty(), "{source}");
    }
    assert!(wrapper_warnings("<svg><title>&lt;x-card&gt;</title></svg>").is_empty());
}
