//! The section reader classifies each statement once, as lightningcss reads
//! the block that holds it, for every scanner.

use crate::modules::{scope, scoped_name};
use crate::token_sections::{self, Grammar, Statement};
use crate::token_tree::Tokens;

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

/// In a style or declarations block, only a statement without a block that
/// starts with an identifier and a colon is a declaration. In a rule list, no
/// statement is one. Another statement without a block is a rule or an
/// at-rule, except in a declarations block, where it is text.
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
    assert_eq!(statements(source, Grammar::Rules), rules);
    assert_eq!(statements(source, Grammar::Lenient), rules);
}

/// A block opens the grammar of what lightningcss parses in it: rules in a
/// grouping block of a rule list, a style rule body in a rule's block, and
/// declarations or text in any other at-rule's block. Keyframes and
/// `@document` blocks hold lenient rule lists.
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
        (Grammar::Rules, "-->.a{}", Grammar::Declarations),
        (Grammar::Rules, "<!--@foo{}", Grammar::Declarations),
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
