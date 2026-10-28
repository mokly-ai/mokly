//! The section reader classifies each statement once, as lightningcss reads
//! the block that holds it, for every scanner.

use crate::modules::{scope, scoped_name};
use crate::token_sections::{self, Grammar, Statement};
use crate::token_tree::Tokens;

#[path = "token_differential_tests.rs"]
mod token_differential_tests;

/// The statements at the first block level of `source`, read with `grammar`.
fn statements(source: &str, grammar: Grammar) -> Vec<Statement> {
    let tokens = Tokens::new(source);
    let mut range = tokens.root();
    let mut statements = Vec::new();
    while let Some(section) = token_sections::next(&tokens, &mut range, grammar) {
        statements.push(section.statement);
    }
    statements
}

/// The grammar of the block that the first statement of `source` opens.
fn block_grammar(source: &str, grammar: Grammar) -> Grammar {
    let tokens = Tokens::new(source);
    let section = token_sections::next(&tokens, &mut tokens.root(), grammar).unwrap();
    section.block.unwrap().grammar
}

/// In every grammar, a statement starts where cssparser starts it: after the
/// whitespace and comments before it. Its prelude starts there too.
#[test]
fn statements_start_after_leading_whitespace_and_comments_in_every_grammar() {
    let cases = [
        (Grammar::Stylesheet, " /* c */ .b{}", ".b{}"),
        (Grammar::Stylesheet, ".a{} /* c */ .b{}", ".b{}"),
        (Grammar::Rules, " /* c */ .b{}", ".b{}"),
        (Grammar::Lenient, " /* c */ from{}", "from{}"),
        (Grammar::Style, " /* c */ .b{}", ".b{}"),
        (Grammar::Style, " /* c */ color:red", "color:red"),
        (Grammar::Declarations, " /* c */ src:url(x)", "src:url(x)"),
    ];
    for (grammar, source, statement) in cases {
        let tokens = Tokens::new(source);
        let mut range = tokens.root();
        let mut last = None;
        while let Some(section) = token_sections::next(&tokens, &mut range, grammar) {
            last = Some(section);
        }
        let section = last.unwrap();
        let start = source.len() - statement.len();
        assert_eq!(section.start, start, "{grammar:?} {source}");
        assert_eq!(
            tokens.nodes[section.prelude.start].start, start,
            "{grammar:?} {source}"
        );
    }
}

/// In a style or declarations block, only a statement without a block that
/// starts with an identifier and a colon is a declaration. In a rule list or
/// a lenient rule list, no statement is one. In a declarations block, every
/// other statement without a block is text. In a style block, such a
/// statement is text only when it is an at-rule under a keyframes name that
/// lightningcss does not know. Every other statement is a rule or an at-rule.
#[test]
fn statements_are_classified_as_lightningcss_reads_a_block() {
    let declaration = |name: &str| Statement::Declaration(name.into());
    let at_rule = |name: &str| Statement::AtRule(name.into());
    let text = |name: Option<&str>| Statement::Text(name.map(Into::into));
    let source = "COLOR : red;--x:{a:b};a:hover{x:y}.a;@APPLY x;*zoom:1;div;@-khtml-keyframes x;@-webkit-keyframes x;.b :global(";
    let style = [
        declaration("color"),
        declaration("--x"),
        Statement::Rule,
        Statement::Rule,
        at_rule("apply"),
        Statement::Rule,
        Statement::Rule,
        text(Some("-khtml-keyframes")),
        at_rule("-webkit-keyframes"),
        Statement::Rule,
    ];
    assert_eq!(statements(source, Grammar::Style), style);
    let declarations = [
        declaration("color"),
        declaration("--x"),
        Statement::Rule,
        text(None),
        text(Some("apply")),
        text(None),
        text(None),
        text(Some("-khtml-keyframes")),
        text(Some("-webkit-keyframes")),
        text(None),
    ];
    assert_eq!(statements(source, Grammar::Declarations), declarations);
    let source = "color:red;--x:{a}.a{}@media all{}@value x;";
    let rules = [
        Statement::Rule,
        Statement::Rule,
        Statement::Rule,
        at_rule("media"),
        at_rule("value"),
    ];
    assert_eq!(statements(source, Grammar::Stylesheet), rules);
    assert_eq!(statements(source, Grammar::Rules), rules);
    assert_eq!(statements(source, Grammar::Lenient), rules);
}

/// A block's grammar depends on its statement and on the grammar around it.
/// In a rule list, a conditional, layer, scope, or starting-style block is a
/// rule list, a rule or `@-moz-document` block is a style block, and a
/// keyframes or `@document` block is a lenient rule list. The stylesheet
/// skips an HTML comment token before a statement, so the statement after it
/// opens its usual block. In a nested rule list, the token starts a rule. In a
/// style block, a rule, conditional, layer, scope, starting-style, or
/// `@-moz-document` block is a style block. In a lenient rule list, a
/// keyframes, conditional, layer, `@document`, scope, or starting-style block
/// is a lenient rule list. Every other block is a declarations block.
#[test]
fn blocks_open_the_grammar_that_lightningcss_parses() {
    let cases = [
        (Grammar::Rules, ".a{}", Grammar::Style),
        (Grammar::Rules, "@MEDIA all{}", Grammar::Rules),
        (
            Grammar::Rules,
            "@-moz-document url-prefix(){}",
            Grammar::Style,
        ),
        (Grammar::Rules, "@keyframes k{}", Grammar::Lenient),
        (Grammar::Rules, "@document x{}", Grammar::Lenient),
        (Grammar::Rules, "@font-face{}", Grammar::Declarations),
        (Grammar::Rules, "@foo{}", Grammar::Declarations),
        (Grammar::Rules, "-->.a{}", Grammar::Style),
        (Grammar::Rules, "<!--@foo{}", Grammar::Style),
        (Grammar::Stylesheet, ".a{}", Grammar::Style),
        (Grammar::Stylesheet, "@MEDIA all{}", Grammar::Rules),
        (
            Grammar::Stylesheet,
            "@-moz-document url-prefix(){}",
            Grammar::Style,
        ),
        (Grammar::Stylesheet, "@keyframes k{}", Grammar::Lenient),
        (Grammar::Stylesheet, "@document x{}", Grammar::Lenient),
        (Grammar::Stylesheet, "@font-face{}", Grammar::Declarations),
        (Grammar::Stylesheet, "@foo{}", Grammar::Declarations),
        (Grammar::Stylesheet, "-->.a{}", Grammar::Style),
        (Grammar::Stylesheet, "<!--@foo{}", Grammar::Declarations),
        (Grammar::Style, "&:hover{}", Grammar::Style),
        (Grammar::Style, "@supports (x:y){}", Grammar::Style),
        (
            Grammar::Style,
            "@-moz-document url-prefix(){}",
            Grammar::Style,
        ),
        (Grammar::Style, "@keyframes k{}", Grammar::Declarations),
        (Grammar::Style, "@foo{}", Grammar::Declarations),
        (Grammar::Lenient, "from{}", Grammar::Declarations),
        (Grammar::Lenient, "@media all{}", Grammar::Lenient),
        (Grammar::Lenient, "@keyframes k{}", Grammar::Lenient),
        (Grammar::Lenient, "@document y{}", Grammar::Lenient),
        (
            Grammar::Lenient,
            "@-moz-document url-prefix(){}",
            Grammar::Declarations,
        ),
        (Grammar::Declarations, ".a{}", Grammar::Declarations),
        (Grammar::Declarations, "@media all{}", Grammar::Declarations),
    ];
    for (grammar, source, expected) in cases {
        assert_eq!(
            block_grammar(source, grammar),
            expected,
            "{grammar:?} {source}"
        );
    }
}

/// Where lightningcss reads no rules, a statement without a block stays as
/// authored: in an unknown at-rule, `@font-face`, a first `@charset` that
/// cssparser skips, an at-rule after `-->`, a keyframe, and a style rule in
/// a keyframes or `@document` block, and as an unknown keyframes at-rule in a
/// style rule. An `@value` there still fails.
#[test]
fn statements_without_a_block_stay_as_authored_where_lightningcss_reads_no_rules() {
    let path = "ui/text.module.css";
    let prefix = scoped_name(path, "");
    let cases: [(&str, &str, &[&str]); 12] = [
        ("@foo{.a}", "@foo{.a}", &[]),
        ("@foo{:export}", "@foo{:export}", &[]),
        ("@foo{.a :global(", "@foo{.a :global(", &[]),
        (
            "@foo{@keyframes :local(x)}",
            "@foo{@keyframes :local(x)}",
            &[],
        ),
        (
            "@font-face{.a;src:local(x)}",
            "@font-face{.a;src:local(x)}",
            &[],
        ),
        ("@charset{.a}", "@charset{.a}", &[]),
        ("-->@foo{.a}", "-->@foo{.a}", &[]),
        (".p{@foo{.a}}", ".{h}p{@foo{.a}}", &["p"]),
        (
            ".p{@x-keyframes :local(k)}",
            ".{h}p{@x-keyframes :local(k)}",
            &["p"],
        ),
        (
            "@keyframes k{from{.a}}",
            "@keyframes {h}k{from{.a}}",
            &["k"],
        ),
        (
            "@keyframes k{@media all{.a{.b}}}",
            "@keyframes {h}k{@media all{.{h}a{.b}}}",
            &["a", "k"],
        ),
        ("@document x{.a{.b}}", "@document x{.{h}a{.b}}", &["a"]),
    ];
    for (source, scoped, exports) in cases {
        let (css, names) = scope(path, source).unwrap();
        assert_eq!(css, scoped.replace("{h}", &prefix), "{source}");
        let names: Vec<_> = names.keys().map(String::as_str).collect();
        assert_eq!(names, exports, "{source}");
    }
    let error = scope(path, "@font-face{@value x: red;}")
        .unwrap_err()
        .to_string();
    assert!(
        error.contains("@value is unsupported in ui/text.module.css:1:12;"),
        "{error}"
    );
}

/// In a style rule, an at-rule under a keyframes name that lightningcss does
/// not know is text only without a block. With a block, the renamer still
/// reads its keyframes name.
#[test]
fn unknown_keyframes_names_scope_only_with_a_block() {
    let path = "ui/text.module.css";
    let prefix = scoped_name(path, "");
    let (css, names) = scope(path, ".p{@-khtml-keyframes k{from{color:red}}}").unwrap();
    let expected = ".{h}p{@-khtml-keyframes {h}k{from{color:red}}}";
    assert_eq!(css, expected.replace("{h}", &prefix));
    let names: Vec<_> = names.keys().map(String::as_str).collect();
    assert_eq!(names, ["k", "p"]);
}
