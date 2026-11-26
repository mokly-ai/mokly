//! Only render calls take the debug render deadline; every other call keeps its own.

use crate::methods::{Call, Generation, RenderPage};

use super::{TestDeadlines, deadline};

fn render() -> Call {
    Call::RenderPage(RenderPage {
        generation: "generation".into(),
        handle: "specs/page.mockup.tsx#default".into(),
    })
}

fn describe() -> Call {
    Call::Describe(Generation {
        generation: "generation".into(),
    })
}

#[test]
fn unset_render_deadline_keeps_the_protocol_and_environment_deadlines() {
    let unset = TestDeadlines::default();
    assert_eq!(deadline(unset, None, &render()), 30_000);
    assert_eq!(deadline(unset, None, &describe()), 120_000);
    assert_eq!(deadline(unset, Some(10_000), &render()), 10_000);
    assert_eq!(deadline(unset, Some(10_000), &describe()), 10_000);
}

#[test]
fn render_deadline_replaces_only_render_calls() {
    let test = TestDeadlines {
        render_ms: Some(1_000),
    };
    assert_eq!(deadline(test, Some(10_000), &render()), 1_000);
    assert_eq!(deadline(test, None, &render()), 1_000);
    assert_eq!(deadline(test, Some(10_000), &describe()), 10_000);
    assert_eq!(deadline(test, None, &describe()), 120_000);
}
