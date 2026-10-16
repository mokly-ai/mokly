//! Control tier precedence, inactive state, and reserved navigation metadata.

use crate::controls::adapt;
use crate::source_checks;
use crate::{parse, serialize};

#[test]
fn warning_tiers_keep_identical_control_bytes_and_have_separate_route_records() {
    let mut nodes = parse::document(
        "<!doctype html><html><head></head><body><label><div to=\"home\"><span tabindex=\"-1\">Go</span></div></label></body></html>",
    );
    let warnings = adapt(&mut nodes, "entry/index.mobile.html").unwrap();
    assert_eq!(warnings.len(), 2);
    assert_eq!(warnings[0].code, "link-control-ancestor");
    assert_eq!(warnings[1].code, "link-control-descendant");
    insta::assert_snapshot!(serialize::html(&nodes));
}

#[test]
fn all_error_features_and_nested_controls_fail_before_navigation() {
    for source in [
        "<a><span to=\"home\">Go</span></a>",
        "<div contenteditable><div to=\"home\">Go</div></div>",
        "<p to=\"home\">Go</p>",
        "<span to=\"home\" role=\"checkbox\">Go</span>",
        "<span to=\"home\" onclick=\"go()\">Go</span>",
        "<span to=\"home\"><input></span>",
        "<span to=\"home\"><div to=\"other\">Go</div></span>",
        "<span to=\"home\"><i tabindex=\"0\"></i><button>Bad</button></span>",
        "<span to=\"home\"><i onfocus=\"secret()\"></i></span>",
        "<div data-mokly-link-control=\"button\"></div>",
        "<div to=\"home\" href=\"mock:other\">Go</div>",
    ] {
        assert!(
            adapt(&mut parse::fragment(source), "route").is_err(),
            "{source}"
        );
    }
}

#[test]
fn inactive_controls_keep_their_element_and_cannot_submit_or_activate() {
    for state in [
        "disabled",
        "aria-disabled=\"true\"",
        "aria-busy=\"true\"",
        "inert",
    ] {
        let mut nodes = parse::fragment(&format!("<button {state} to=\"home\">Go</button>"));
        adapt(&mut nodes, "route").unwrap();
        let html = serialize::html(&nodes);
        assert!(html.contains("<button"));
        assert!(html.contains("type=\"button\""));
        assert!(html.contains("data-nav-href=\"mock:home\""));
        assert!(!html.contains("data-mokly-link-control"));
    }
    let mut nodes = parse::fragment(
        "<fieldset disabled><legend><button to=\"home\">Go</button></legend></fieldset>",
    );
    adapt(&mut nodes, "route").unwrap();
    assert!(!serialize::html(&nodes).contains("<a"));
    for (tag, attributes) in [
        ("a", "aria-disabled=\"true\" href=\"mock:home\""),
        ("div", "role=\"button\" aria-busy=\"true\" tabindex=\"0\""),
    ] {
        let mut nodes = parse::fragment(&format!(
            "<{tag} {attributes} to=\"home\">Unavailable</{tag}>"
        ));
        assert!(adapt(&mut nodes, "route").unwrap().is_empty());
        let html = serialize::html(&nodes);
        assert!(html.starts_with(&format!("<{tag} ")), "{html}");
        assert!(html.ends_with(&format!(">Unavailable</{tag}>")), "{html}");
        assert!(html.contains("data-nav-href=\"mock:home\""));
        assert!(!html.contains(" href="));
        assert!(!html.contains("data-mokly-link-control"));
    }
}

#[test]
fn duplicate_and_reserved_navigation_attributes_survive_token_validation() {
    for source in [
        "<a href=\"mock:a\" HREF=\"mock:b\">Go</a>",
        "<a data-nav-href=\"mock:a\" data-nav-href=\"mock:b\"></a>",
        "<a data-mokly-link=\"a\"></a>",
        "<div data-mokly-link-control-extra=\"x\"></div>",
    ] {
        assert!(source_checks::validate(source, false).is_err(), "{source}");
    }
    assert!(source_checks::validate("<p title=\"a\" title=\"b\">Text</p>", false).is_ok());
    assert!(source_checks::validate("<!--mokly-instance:start id=\"r-0\"-->", false).is_ok());
    assert_eq!(
        source_checks::validate(
            "<a href=\"mock:home\" data-mokly-target=\"_blank\" DATA-MOKLY-TARGET=\"_self\">Go</a>",
            false
        )
        .unwrap_err()
        .to_string(),
        "[mokly-html/build-invalid] duplicate navigation attribute data-mokly-target"
    );
}

#[test]
fn ancestor_features_leave_the_stack_before_the_next_sibling() {
    let mut nodes = parse::fragment(
        "<label><div role=\"button\"><span to=\"home\">A</span></div><span to=\"home\">B</span></label><span to=\"home\">C</span>",
    );
    let warnings = adapt(&mut nodes, "route").unwrap();
    assert_eq!(warnings.len(), 2);
    assert_eq!(
        warnings[0].message,
        "MockLink child control is inside <div role=\"button\">; one click or key press has two targets"
    );
    assert_eq!(
        warnings[1].message,
        "MockLink child control is inside <label>; one click or key press has two targets"
    );
    assert_eq!(
        serialize::html(&nodes)
            .matches("data-mokly-link-control")
            .count(),
        3
    );
}

#[test]
fn nearest_error_ancestor_takes_precedence_over_a_closer_warning() {
    for value in ["", "true", "plaintext-only"] {
        let mut nodes = parse::fragment(&format!(
            "<div contenteditable=\"{value}\"><span to=\"home\">Go</span></div>"
        ));
        let error = adapt(&mut nodes, "route").unwrap_err();
        assert!(error.to_string().ends_with(&format!(
            "MockLink child control is inside <div contenteditable=\"{value}\">; move the control outside it"
        )));
    }
    let mut nodes = parse::fragment(
        "<section contenteditable=\"true\"><div contenteditable=\"plaintext-only\"><label><span to=\"home\">Go</span></label></div></section>",
    );
    let error = adapt(&mut nodes, "route").unwrap_err();
    assert!(error.to_string().contains("MockLink child control is inside <div contenteditable=\"plaintext-only\">; move the control outside it"));
}
