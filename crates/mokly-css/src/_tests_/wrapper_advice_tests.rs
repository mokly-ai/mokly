//! An author who follows the advice of an empty-wrapper error reaches a
//! stylesheet that scopes, for every case of the wrapper table.

use crate::modules::scope;
use crate::wrapper_table_tests::{FORMS, OUTERS, PATH, ROWS, empty_wrapper};

/// One way to follow the advice of an empty-wrapper error.
#[derive(Clone, Copy)]
enum Action {
    /// Put this content inside the wrapper.
    Add(&'static str),
    /// Delete the wrapper.
    Remove,
}

/// The actions that a catalogued piece of advice offers.
fn actions(advice: &str) -> Vec<Action> {
    let action = |text| match text {
        "add a selector inside it" => Action::Add(".x"),
        "add the name inside it" => Action::Add("fade"),
        "remove it" => Action::Remove,
        other => panic!("unknown advice {other:?}"),
    };
    advice.split(" or ").map(action).collect()
}

/// The wrapper name, column, and advice of a catalogued empty-wrapper error.
fn advice(error: &str) -> Option<(&str, usize, &str)> {
    let rest = error.strip_prefix("[mokly-css/build-invalid] CSS Modules :")?;
    let (name, rest) = rest.split_once("() has no ")?;
    let (_, rest) = rest.split_once(&*format!(" in {PATH}:1:"))?;
    let (column, advice) = rest.split_once("; ")?;
    Some((name, column.parse().ok()?, advice))
}

/// The source after one action on the closed `:{name}(...)` at `column`.
fn follow(source: &str, name: &str, column: usize, action: Action) -> String {
    let start = column - 1;
    let open = start + name.len() + 2;
    let close = open + source[open..].find(')').unwrap();
    match action {
        Action::Add(content) => format!("{}{content}{}", &source[..open], &source[open..]),
        Action::Remove => format!("{}{}", &source[..start], &source[close + 1..]),
    }
}

/// True when following the advice of each error, at most `steps` times,
/// gives a stylesheet that scopes. Any other failure ends that path.
fn recovers(source: &str, steps: usize) -> bool {
    let Err(error) = scope(PATH, source) else {
        return true;
    };
    let error = error.to_string();
    let Some((name, column, advice)) = advice(&error) else {
        return false;
    };
    let mut paths = actions(advice).into_iter();
    steps > 0 && paths.any(|action| recovers(&follow(source, name, column, action), steps - 1))
}

/// An author who follows the advice reaches a stylesheet that scopes, in
/// every context and at every level. A wrapper open at the end of input
/// leaves the stylesheet incomplete, so its advice is not followed here.
#[test]
fn following_the_advice_of_each_empty_wrapper_error_gives_a_stylesheet_that_scopes() {
    let mut followed = 0;
    for row in &ROWS {
        for outer in OUTERS {
            for form in FORMS.into_iter().flatten() {
                for name in ["global", "local"] {
                    let (source, _) = empty_wrapper(row, outer, Some(form), name);
                    assert!(recovers(&source, 3), "{source}");
                    followed += 1;
                }
            }
        }
    }
    assert_eq!(followed, 144);
}
