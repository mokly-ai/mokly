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
}
