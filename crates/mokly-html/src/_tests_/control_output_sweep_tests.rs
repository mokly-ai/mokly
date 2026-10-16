//! Preserve authored control content while consuming only the control contract.

use crate::controls::adapt;
use crate::source_checks;
use crate::{parse, serialize};

#[test]
fn sibling_controls_keep_attributes_and_add_one_html_head_stylesheet() {
    let mut nodes = parse::document(
        "<!doctype html><html><head><title>Controls</title></head><body><!-- spelling --><p class='untouched'>A &amp; B &#67;</p><DIV TO='home' class='row' STYLE='display:flex' data-owner='consumer'><span title='A &amp; B'>Keep &#x20; content</span></DIV><hr><span to='home'>Second</span><svg><head></head></svg></body></html>",
    );
    let before = serialize::html(&nodes);
    let foreign = before
        .split("<svg>")
        .nth(1)
        .unwrap()
        .split("</svg>")
        .next()
        .unwrap()
        .to_owned();
    assert!(adapt(&mut nodes, "route").unwrap().is_empty());
    let html = serialize::html(&nodes);
    assert!(html.contains("<!-- spelling -->"));
    assert!(html.contains("<p class=\"untouched\">A &amp; B C</p>"));
    assert!(html.contains("class=\"row\" style=\"display:flex\" data-owner=\"consumer\""));
    assert!(html.contains("<span title=\"A &amp; B\">Keep   content</span>"));
    assert_eq!(html.matches("<style>").count(), 1);
    assert_eq!(html.matches("href=\"mock:home\"").count(), 2);
    assert!(html.contains("</a><hr><a href=\"mock:home\""), "{html}");
    assert!(html.contains("<head><title>Controls</title><style>"));
    assert!(html.contains(&format!("<svg>{foreign}</svg>")), "{html}");
}

#[test]
fn inactive_ancestors_remove_button_submission_attributes_but_keep_the_label() {
    for (tag, state) in [
        ("fieldset", "disabled"),
        ("div", "inert"),
        ("div", "aria-disabled=\"true\""),
        ("div", "aria-busy=\"true\""),
    ] {
        let mut nodes = parse::document(&format!(
            "<!doctype html><html><head></head><body><{tag} {state}><button to=\"home\" type=\"submit\" form=\"payments\" formaction=\"/charge\" name=\"action\" value=\"pay\">Continue</button></{tag}></body></html>"
        ));
        assert!(adapt(&mut nodes, "route").unwrap().is_empty());
        let html = serialize::html(&nodes);
        assert!(html.contains("<button") && html.contains("Continue</button>"));
        assert!(html.contains("type=\"button\"") && html.contains("data-nav-href=\"mock:home\""));
        for forbidden in [
            "form=",
            "formaction=",
            "name=",
            "value=",
            "<style",
            "data-mokly-link-control",
        ] {
            assert!(!html.contains(forbidden), "{html}");
        }
    }
}

#[test]
fn reserved_control_metadata_is_rejected_in_all_namespaces_and_inert_content() {
    for source in [
        "<a data-mokly-link-control=\"button\">Unrelated</a>",
        "<a DATA-MOKLY-LINK-CONTROL=\"div\">Unrelated</a>",
        "<style data-mokly-link-control-styles>p{color:red}</style>",
        "<div data-mokly-link-control-future></div>",
        "<template><a data-mokly-link-control=\"span\">Inert</a></template>",
        "<svg><a DATA-MOKLY-LINK-CONTROL=\"a\">Foreign</a></svg>",
    ] {
        for control in ["", "<button to=\"home\">Go</button>"] {
            assert!(
                source_checks::validate(&format!("{source}{control}"), false).is_err(),
                "{source}"
            );
        }
    }
    let literal = "<p data-example=\"data-mokly-link-control\">DATA-MOKLY-LINK-CONTROL</p><!-- ordinary metadata text --><style>.example::after{content:'data-mokly-link-control'}</style>";
    assert!(source_checks::validate(literal, false).is_ok());
    let before = serialize::html(&parse::fragment(literal));
    for control in ["", "<button to=\"home\">Go</button>"] {
        let mut nodes = parse::fragment(&format!("{literal}{control}"));
        assert!(adapt(&mut nodes, "route").unwrap().is_empty());
        assert!(serialize::html(&nodes).starts_with(&before));
    }
}
