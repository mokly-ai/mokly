//! The catalogue checks and the authored tree read the same elements from one token stream.

use mokly_catalogue::html_tokens::{self, Token};
use mokly_catalogue::template_types::Template;

use crate::parse;
use crate::tree::{self, Node};

const CONTEXTS: &[&str] = &[
    "{}",
    "<noscript>{}</noscript>",
    "<noscript><style>{}</style></noscript>",
    "<svg><style>{}</style></svg>",
    "<svg><script>{}</script></svg>",
    "<svg><textarea>{}</textarea></svg>",
    "<svg><title><style>{}</style></title></svg>",
    "<svg><desc><style>{}</style></desc></svg>",
    "<svg><foreignObject><style>{}</style></foreignObject></svg>",
    "<svg><foreignObject><title>{}</title></foreignObject></svg>",
    "<math><title>{}</title></math>",
    "<math><mi><style>{}</style></mi></math>",
    "<math><annotation-xml><style>{}</style></annotation-xml></math>",
    "<math><annotation-xml encoding='text/html'><style>{}</style></annotation-xml></math>",
    "<noframes>{}</noframes>",
    "<template>{}</template>",
    "<table><tr><td>{}</td></tr>{}</table>",
    "<select>{}</select>",
    "<textarea>{}</textarea>",
    "<p>{}<plaintext>{}",
];

const WRAPPER: &str = "<mokly-ignore-scope enabled='true' typo='x'>A</mokly-ignore-scope>";

fn template(body: &str, page: bool) -> Template {
    Template {
        source_path: "specs/example.html".into(),
        source: body.into(),
        body: body.into(),
        body_offset: 0,
        page,
    }
}

fn token_wrappers(template: &Template) -> usize {
    html_tokens::parse(template.html())
        .filter(|parsed| {
            matches!(&parsed.token, Token::StartTag(tag) if tag.name.as_slice() == b"mokly-ignore-scope")
        })
        .count()
}

fn tree_wrappers(template: &Template) -> usize {
    tree::walk(&parse::html(template.located_html()))
        .filter(
            |node| matches!(node, Node::Element(element) if element.name == "mokly-ignore-scope"),
        )
        .count()
}

#[test]
fn checks_and_tree_see_the_same_wrappers() {
    for context in CONTEXTS {
        let body = context.replace("{}", WRAPPER);
        for (page, body) in [
            (false, body.clone()),
            (
                true,
                format!("<!doctype html><html><head></head><body>{body}</body></html>"),
            ),
        ] {
            let template = template(&body, page);
            assert_eq!(
                token_wrappers(&template),
                tree_wrappers(&template),
                "{body}"
            );
        }
    }
}
