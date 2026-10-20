//! One table test: in every scoped context and at every nesting level, local
//! names scope, and an empty wrapper fails with the words for what it holds.

use crate::modules::{scope, scoped_name};

const PATH: &str = "ui/table.module.css";

/// Where a wrapper appears, and the catalogued words for an empty one there.
struct Context {
    /// Text before the wrapper.
    before: &'static str,
    /// Text after the wrapper.
    after: &'static str,
    /// What the wrapper holds, as the error names it.
    holds: &'static str,
    /// The recovery action that the error gives.
    action: &'static str,
}

const SELECTOR: Context = Context {
    before: ".a ",
    after: "{color:red}",
    holds: "selector",
    action: "add a selector inside it or remove it",
};
const SCOPE: Context = Context {
    before: "@scope (",
    after: "){.b{color:red}}",
    holds: "selector",
    action: "add a selector inside it or remove it",
};
const KEYFRAMES: Context = Context {
    before: "@keyframes ",
    after: " spin{to{opacity:0}}",
    holds: "keyframes name",
    action: "add the name inside it",
};

/// A nesting level: the text that opens and closes it, and whether the
/// scanner reads its statements as declarations.
struct Level {
    open: &'static str,
    close: &'static str,
    declarations: bool,
}

const TOP: Level = Level {
    open: "",
    close: "",
    declarations: false,
};
const GROUPING: Level = Level {
    open: "@media all{",
    close: "}",
    declarations: false,
};
const STYLE_RULE: Level = Level {
    open: ".p{",
    close: "}",
    declarations: true,
};
/// A declaration block that can hold keyframes: lightningcss rejects
/// keyframes in a style rule but accepts them here.
const DOCUMENT: Level = Level {
    open: "@-moz-document url-prefix(){",
    close: "}",
    declarations: true,
};

/// One context at one level: a stylesheet whose local names scope there, its
/// scoped text with `{h}` for the generated prefix, and its sorted exports.
struct Row {
    context: Context,
    level: Level,
    source: &'static str,
    scoped: &'static str,
    exports: &'static [&'static str],
}

const ROWS: [Row; 9] = [
    Row {
        context: SELECTOR,
        level: TOP,
        source: ".a{color:red}",
        scoped: ".{h}a{color:red}",
        exports: &["a"],
    },
    Row {
        context: SELECTOR,
        level: GROUPING,
        source: "@media all{.a{color:red}}",
        scoped: "@media all{.{h}a{color:red}}",
        exports: &["a"],
    },
    Row {
        context: SELECTOR,
        level: STYLE_RULE,
        source: ".p{.a{color:red}}",
        scoped: ".{h}p{.{h}a{color:red}}",
        exports: &["a", "p"],
    },
    Row {
        context: SCOPE,
        level: TOP,
        source: "@scope (.a){.b{color:red}}",
        scoped: "@scope (.{h}a){.{h}b{color:red}}",
        exports: &["a", "b"],
    },
    Row {
        context: SCOPE,
        level: GROUPING,
        source: "@media all{@scope (.a){.b{color:red}}}",
        scoped: "@media all{@scope (.{h}a){.{h}b{color:red}}}",
        exports: &["a", "b"],
    },
    Row {
        context: SCOPE,
        level: STYLE_RULE,
        source: ".p{@scope (.a){color:red}}",
        scoped: ".{h}p{@scope (.{h}a){color:red}}",
        exports: &["a", "p"],
    },
    Row {
        context: KEYFRAMES,
        level: TOP,
        source: "@keyframes spin{to{opacity:0}}.a{animation:spin 1s}",
        scoped: "@keyframes {h}spin{to{opacity:0}}.{h}a{animation:{h}spin 1s}",
        exports: &["a", "spin"],
    },
    Row {
        context: KEYFRAMES,
        level: GROUPING,
        source: "@media all{@keyframes spin{to{opacity:0}}}.a{animation:spin 1s}",
        scoped: "@media all{@keyframes {h}spin{to{opacity:0}}}.{h}a{animation:{h}spin 1s}",
        exports: &["a", "spin"],
    },
    Row {
        context: KEYFRAMES,
        level: DOCUMENT,
        source: "@-moz-document url-prefix(){@keyframes spin{to{opacity:0}}.a{animation:spin 1s}}",
        scoped: "@-moz-document url-prefix(){@keyframes {h}spin{to{opacity:0}}.{h}a{animation:{h}spin 1s}}",
        exports: &["a", "spin"],
    },
];

/// Empty wrapper contents; `None` leaves the wrapper open at the end of input.
const FORMS: [Option<&str>; 4] = [Some(""), Some(" "), Some("/**/"), None];
/// The wrapper levels around the empty wrapper: none, or one `:local()`.
const OUTERS: [&str; 2] = ["", ":local("];
/// How the syntax check reports a stylesheet that it cannot parse.
const SYNTAX: &str = "[mokly-css/build-invalid] could not transform CSS";

/// One empty `:{name}()` in a row's context, inside `outer`, and the
/// catalogued error for it. The error is `None` where the syntax check
/// rejects the stylesheet first: a wrapper left open at the end of input
/// inside a declaration block leaves a statement without a block, which
/// reads as a declaration.
fn empty_wrapper(
    row: &Row,
    outer: &str,
    form: Option<&str>,
    name: &str,
) -> (String, Option<String>) {
    let (context, level) = (&row.context, &row.level);
    let opened = format!("{}{}{outer}:{name}(", level.open, context.before);
    let column = level.open.len() + context.before.len() + outer.len() + 1;
    let error = format!(
        "[mokly-css/build-invalid] CSS Modules :{name}() has no {} in {PATH}:1:{column}; {}",
        context.holds, context.action
    );
    match form {
        Some(body) => {
            let closers = if outer.is_empty() { ")" } else { "))" };
            let source = format!("{opened}{body}{closers}{}{}", context.after, level.close);
            (source, Some(error))
        }
        None => (opened, (!level.declarations).then_some(error)),
    }
}

#[test]
fn scoped_contexts_scope_names_and_reject_empty_wrappers_at_every_level() {
    let prefix = scoped_name(PATH, "");
    let (mut catalogued, mut syntax) = (0, 0);
    for row in &ROWS {
        let (css, exports) = scope(PATH, row.source).unwrap();
        assert_eq!(css, row.scoped.replace("{h}", &prefix), "{}", row.source);
        let names: Vec<_> = exports.keys().map(String::as_str).collect();
        assert_eq!(names, row.exports, "{}", row.source);
        for outer in OUTERS {
            for form in FORMS {
                for name in ["global", "local"] {
                    let (source, expected) = empty_wrapper(row, outer, form, name);
                    let error = scope(PATH, &source).unwrap_err().to_string();
                    if let Some(expected) = expected {
                        assert_eq!(error, expected, "{source}");
                        catalogued += 1;
                    } else {
                        assert!(error.starts_with(SYNTAX), "{source}: {error}");
                        syntax += 1;
                    }
                }
            }
        }
    }
    assert_eq!((catalogued, syntax), (132, 12));
}
