//! Port the former link-control placement matrix to the shared HTML adapter.

use mokly_catalogue::html_input::DeliveredHtml;

use crate::controls::adapt;
use crate::{parse, serialize};

const INTERACTIVE: &[&str] = &[
    "button",
    "link",
    "checkbox",
    "combobox",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "radio",
    "searchbox",
    "slider",
    "spinbutton",
    "switch",
    "tab",
    "textbox",
    "treeitem",
];
const STRUCTURAL: &[&str] = &[
    "gridcell",
    "listbox",
    "menu",
    "menubar",
    "radiogroup",
    "tablist",
    "tree",
    "treegrid",
];

fn document(body: &str) -> Vec<crate::tree::Node> {
    parse::html(DeliveredHtml::document(&format!(
        "<!doctype html><html><head></head><body>{body}</body></html>"
    )))
}

#[test]
fn ancestor_placement_matrix_preserves_every_silent_and_warning_case() {
    let mut silent = vec![
        ("main", "tabindex=\"-1\"".to_owned()),
        ("audio", String::new()),
        ("video", String::new()),
        ("div", "contenteditable=\"false\"".into()),
    ];
    silent.extend(
        STRUCTURAL
            .iter()
            .map(|role| ("div", format!("role=\"{role}\""))),
    );
    silent.extend(["0", "3", "-1"].map(|tab| ("div", format!("tabindex=\"{tab}\""))));
    for (tag, attributes) in silent {
        let mut nodes = document(&format!(
            "<{tag} {attributes}><span to=\"home\">Go</span></{tag}>"
        ));
        assert!(
            adapt(&mut nodes, "route").unwrap().is_empty(),
            "{tag} {attributes}"
        );
        assert!(serialize::html(&nodes).contains("href=\"mock:home\""));
    }
    let mut details = document(
        "<details><summary>Summary</summary><div><span to=\"home\">Go</span></div></details>",
    );
    assert!(adapt(&mut details, "route").unwrap().is_empty());
    let mut warned = vec![
        ("button", String::new()),
        ("label", String::new()),
        ("summary", String::new()),
        ("object", String::new()),
        ("audio", "controls=\"\"".into()),
        ("video", "controls=\"\"".into()),
    ];
    warned.extend(
        INTERACTIVE
            .iter()
            .map(|role| ("div", format!("role=\"{role}\""))),
    );
    for (tag, attribute) in warned {
        let mut nodes = document(&format!(
            "<{tag} {attribute}><span to=\"home\">Go</span></{tag}>"
        ));
        let warnings = adapt(&mut nodes, "route").unwrap();
        let feature = if attribute.is_empty() {
            format!("<{tag}>")
        } else {
            format!("<{tag} {attribute}>")
        };
        assert_eq!(warnings.len(), 1, "{feature}");
        assert_eq!(warnings[0].code, "link-control-ancestor");
        assert_eq!(
            warnings[0].message,
            format!(
                "MockLink child control is inside {feature}; one click or key press has two targets"
            )
        );
        assert!(serialize::html(&nodes).contains("data-mokly-link-control=\"span\""));
    }
}

#[test]
fn descendant_placement_matrix_covers_roles_elements_media_and_editability() {
    for role in STRUCTURAL {
        let mut nodes = document(&format!(
            "<div to=\"home\"><span role=\"{role}\">Group</span></div>"
        ));
        let warnings = adapt(&mut nodes, "route").unwrap();
        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0].code, "link-control-descendant");
        assert_eq!(
            warnings[0].message,
            format!(
                "MockLink child control contains <span role=\"{role}\">; the role does not belong inside a link"
            )
        );
    }
    for tab in ["0", "-1"] {
        let mut nodes = document(&format!(
            "<div to=\"home\"><span tabindex=\"{tab}\">Focus</span></div>"
        ));
        assert_eq!(
            adapt(&mut nodes, "route").unwrap()[0].message,
            format!(
                "MockLink child control contains <span tabindex=\"{tab}\">; the link has an extra focus stop"
            )
        );
    }
    let mut silent = document(
        "<div to=\"home\"><audio></audio><video></video><span contenteditable=\"false\">Text</span></div>",
    );
    assert!(adapt(&mut silent, "route").unwrap().is_empty());
    let mut cases: Vec<_> = [
        "a", "area", "button", "input", "select", "textarea", "summary", "details", "label",
        "iframe", "object", "embed",
    ]
    .map(|tag| (format!("<{tag}></{tag}>"), format!("<{tag}>")))
    .into();
    cases.extend(INTERACTIVE.iter().map(|role| {
        (
            format!("<span role=\"{role}\"></span>"),
            format!("<span role=\"{role}\">"),
        )
    }));
    cases.extend(["", "true", "plaintext-only"].map(|value| {
        (
            format!("<span contenteditable=\"{value}\"></span>"),
            format!("<span contenteditable=\"{value}\">"),
        )
    }));
    cases.extend(["audio", "video"].map(|tag| {
        (
            format!("<{tag} controls></{tag}>"),
            format!("<{tag} controls=\"\">"),
        )
    }));
    cases.push((
        "<svg><a href=\"mock:home\">SVG</a></svg>".into(),
        "<a>".into(),
    ));
    cases.push((
        "<button disabled>Disabled</button>".into(),
        "<button>".into(),
    ));
    for (body, feature) in cases {
        let error = adapt(
            &mut document(&format!("<div to=\"home\">{body}</div>")),
            "route",
        )
        .unwrap_err();
        assert!(
            error.to_string().contains(&format!(
                "MockLink child control contains {feature}; remove the nested interactive element"
            )),
            "{error}"
        );
    }
}

#[test]
fn placement_order_selects_the_strongest_first_feature_without_leaking_handlers() {
    for (body, expected) in [
        ("<a><p to=\"home\">Unsupported</p></a>", "is inside <a>"),
        (
            "<a><label><span to=\"home\">Go</span></label></a>",
            "is inside <a>",
        ),
        (
            "<p to=\"home\"><button>Nested</button></p>",
            "unsupported root <p>",
        ),
        (
            "<div to=\"home\"><span tabindex=\"0\"></span><input><button>Later</button></div>",
            "contains <input>",
        ),
        (
            "<div to=\"home\"><button tabindex=\"0\"></button></div>",
            "contains <button>",
        ),
        (
            "<div to=\"home\"><span role=\"button\" onclick=\"secret\"></span></div>",
            "contains <span role=\"button\">",
        ),
        (
            "<div to=\"home\"><span onmouseover=\"first-secret\" onclick=\"second-secret\"></span></div>",
            "contains <span onmouseover>; remove the inline event handler",
        ),
    ] {
        let error = adapt(&mut document(body), "route").unwrap_err().to_string();
        assert!(error.contains(expected), "{error}");
        assert!(!error.contains("secret"));
    }
    let mut nodes = document(
        "<label><button disabled><div to=\"home\"><span role=\"menu\" tabindex=\"0\">Group</span></div></button></label>",
    );
    let warnings = adapt(&mut nodes, "route").unwrap();
    assert_eq!(warnings.len(), 2);
    assert_eq!(
        warnings[0].message,
        "MockLink child control is inside <button>; one click or key press has two targets"
    );
    assert_eq!(
        warnings[1].message,
        "MockLink child control contains <span role=\"menu\">; the role does not belong inside a link"
    );
}

#[test]
fn placement_messages_normalize_roles_and_escape_terminal_controls() {
    for (body, expected) in [
        (
            "<div role=\" presentation\n button &quot;named&quot; \"><span to=\"home\">Go</span></div>",
            "<div role=\"presentation button &quot;named&quot;\">",
        ),
        (
            "<div to=\"home\"><span role=\" presentation\n menu &quot;named&quot; \">Group</span></div>",
            "<span role=\"presentation menu &quot;named&quot;\">",
        ),
        (
            "<div role=\"button &#x1b;[2J\"><span to=\"home\">Go</span></div>",
            "<div role=\"button \\u001b[2J\">",
        ),
    ] {
        let warnings = adapt(&mut document(body), "route").unwrap();
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].message.contains(expected), "{:?}", warnings);
        assert!(!warnings[0].message.contains(['\n', '\r', '\u{1b}']));
    }
}
