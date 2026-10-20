//! One table test: in every scoped context and at every nesting level, local
//! names scope, and an empty wrapper fails with the words for what it holds.

use crate::modules::{scope, scoped_name};

pub(crate) const PATH: &str = "ui/table.module.css";

/// Where a wrapper appears, and the catalogued words for an empty one there.
pub(crate) struct Context {
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
/// A keyframes prelude where a name follows the wrapper.
const KEYFRAMES: Context = Context {
    before: "@keyframes ",
    after: " spin{to{opacity:0}}",
    holds: "keyframes name",
    action: "add the name inside it or remove it",
};
/// A keyframes prelude whose only name is inside the wrapper.
const WRAPPED_KEYFRAMES: Context = Context {
    before: "@keyframes ",
    after: "{to{opacity:0}}",
    holds: "keyframes name",
    action: "add the name inside it or remove it",
};

/// A nesting level: the text that opens and closes it.
pub(crate) struct Level {
    open: &'static str,
    close: &'static str,
}

const TOP: Level = Level {
    open: "",
    close: "",
};
const GROUPING: Level = Level {
    open: "@media all{",
    close: "}",
};
/// A style rule's block: a statement in it without a block is still a rule
/// or an at-rule unless it starts with an identifier and a colon.
const STYLE_RULE: Level = Level {
    open: ".p{",
    close: "}",
};
/// A block that reads as a style rule's block but can hold keyframes:
/// lightningcss rejects keyframes in a style rule but accepts them here.
const DOCUMENT: Level = Level {
    open: "@-moz-document url-prefix(){",
    close: "}",
};

/// One context at one level: a stylesheet whose local names scope there, its
/// scoped text with `{h}` for the generated prefix, and its sorted exports.
pub(crate) struct Row {
    context: Context,
    level: Level,
    source: &'static str,
    scoped: &'static str,
    exports: &'static [&'static str],
}

pub(crate) const ROWS: [Row; 12] = [
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
    Row {
        context: WRAPPED_KEYFRAMES,
        level: TOP,
        source: "@keyframes :local(spin){to{opacity:0}}.a{animation:spin 1s}",
        scoped: "@keyframes {h}spin{to{opacity:0}}.{h}a{animation:{h}spin 1s}",
        exports: &["a", "spin"],
    },
    Row {
        context: WRAPPED_KEYFRAMES,
        level: GROUPING,
        source: "@media all{@keyframes :local(spin){to{opacity:0}}}.a{animation:spin 1s}",
        scoped: "@media all{@keyframes {h}spin{to{opacity:0}}}.{h}a{animation:{h}spin 1s}",
        exports: &["a", "spin"],
    },
    Row {
        context: WRAPPED_KEYFRAMES,
        level: DOCUMENT,
        source: "@-moz-document url-prefix(){@keyframes :local(spin){to{opacity:0}}.a{animation:spin 1s}}",
        scoped: "@-moz-document url-prefix(){@keyframes {h}spin{to{opacity:0}}.{h}a{animation:{h}spin 1s}}",
        exports: &["a", "spin"],
    },
];

/// Empty wrapper contents; `None` leaves the wrapper open at the end of input.
pub(crate) const FORMS: [Option<&str>; 4] = [Some(""), Some(" "), Some("/**/"), None];
/// The wrapper levels around the empty wrapper: none, or one `:local()`.
pub(crate) const OUTERS: [&str; 2] = ["", ":local("];

/// One empty `:{name}()` in a row's context, inside `outer`, and the
/// catalogued error for it. A wrapper left open at the end of input leaves
/// its statement without a block, which is still the same rule or at-rule.
pub(crate) fn empty_wrapper(
    row: &Row,
    outer: &str,
    form: Option<&str>,
    name: &str,
) -> (String, String) {
    let (context, level) = (&row.context, &row.level);
    let opened = format!("{}{}{outer}:{name}(", level.open, context.before);
    let column = level.open.len() + context.before.len() + outer.len() + 1;
    let error = format!(
        "[mokly-css/build-invalid] CSS Modules :{name}() has no {} in {PATH}:1:{column}; {}",
        context.holds, context.action
    );
    let Some(body) = form else {
        return (opened, error);
    };
    let closers = if outer.is_empty() { ")" } else { "))" };
    let source = format!("{opened}{body}{closers}{}{}", context.after, level.close);
    (source, error)
}

#[test]
fn scoped_contexts_scope_names_and_reject_empty_wrappers_at_every_level() {
    let prefix = scoped_name(PATH, "");
    let mut catalogued = 0;
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
                    assert_eq!(error, expected, "{source}");
                    catalogued += 1;
                }
            }
        }
    }
    assert_eq!(catalogued, 192);
}
