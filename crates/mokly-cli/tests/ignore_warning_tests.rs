//! Unknown ignore-wrapper attributes warn before strict output installation.

use std::fs;
use std::path::Path;
use std::process::Command;

#[test]
fn unknown_ignore_attributes_warn_once_and_strict_preserves_output() {
    let root = tempfile::tempdir().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\nvariants: [{slug: other, title: Other}]\n---\n<mokly-ignore-scope enabled='true' typo='ignored'><mokly-ignore id='clock' extra='{{missing}}'><p>Clock</p></mokly-ignore></mokly-ignore-scope>",
    )
    .unwrap();
    let mut previous = None;
    for strict in [false, true] {
        let mut command = Command::new(env!("CARGO_BIN_EXE_mokly"));
        command.args(["build", "--no-changes", "--out", "site"]);
        if strict {
            command.arg("--strict");
        }
        let output = command
            .current_dir(root.path())
            .env("MOKLY_OUTPUT", "plain")
            .env("PATH", "")
            .env(
                "MOKLY_PACKAGE_ROOT",
                Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly"),
            )
            .output()
            .unwrap();
        let stderr = String::from_utf8(output.stderr).unwrap();
        assert_eq!(output.status.code(), Some(i32::from(strict)), "{stderr}");
        assert_eq!(stderr.matches("[mokly/warning]").count(), 2, "{stderr}");
        assert!(stderr.contains("unknown attribute extra on <mokly-ignore> is ignored"));
        assert!(stderr.contains("unknown attribute typo on <mokly-ignore-scope> is ignored"));
        let index = fs::read(root.path().join("site/mokly-viewer/index.json")).unwrap();
        if let Some(previous) = previous {
            assert_eq!(index, previous);
            assert!(stderr.contains("2 build warnings with --strict"));
        } else {
            let html = fs::read_to_string(
                root.path()
                    .join("site/static/mokly-generated/home/index.mobile.html"),
            )
            .unwrap();
            assert!(html.contains("<p>Clock</p>"));
            assert!(!html.contains("mokly-ignore") && !html.contains("missing"));
        }
        previous = Some(index);
    }
}

#[test]
fn saved_slot_ignore_attributes_are_not_evaluated() {
    check_saved_slot_attribute(
        "extra='{{missing}}'",
        "unknown attribute extra on <mokly-ignore> is ignored",
    );
}

#[test]
fn saved_slot_reserved_wrapper_attributes_are_not_evaluated() {
    for name in ["data-mokly-link", "data-mokly-link-control-future"] {
        check_saved_slot_attribute(
            &format!("{name}='{{{{missing}}}}'"),
            &format!("reserved navigation metadata {name} on <mokly-ignore> is rejected"),
        );
    }
}

fn check_saved_slot_attribute(attribute: &str, warning: &str) {
    let root = tempfile::tempdir().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        root.path().join("specs/panel.component.html"),
        format!(
            "---\ntitle: Panel\nelement: ui-panel\npropSchema: {{type: object, additionalProperties: false, properties: {{}}}}\nslots: [children]\nvariants:\n  - slug: saved\n    title: Saved\n    props: {{}}\n    slots:\n      children: \"<mokly-ignore id='saved' {attribute}><b>Saved</b></mokly-ignore>\"\n---\n<slot></slot>"
        ),
    )
    .unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<ui-panel></ui-panel>",
    )
    .unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["build", "--no-changes", "--out", "site"])
        .current_dir(root.path())
        .output()
        .unwrap();
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert!(output.status.success(), "{attribute}: {stderr}");
    assert!(stderr.contains(warning), "{stderr}");
}

#[test]
fn unknown_ignore_href_does_not_validate_a_logical_link() {
    check_ignored_attribute("href='mock:missing'", "href");
}

#[test]
fn unknown_ignore_slot_does_not_validate_a_missing_slot() {
    check_ignored_attribute("slot='missing'", "slot");
}

#[test]
fn unknown_ignore_slot_does_not_route_content_to_a_declared_slot() {
    check_ignored_attribute("slot='named'", "slot");
}

fn check_ignored_attribute(attribute: &str, name: &str) {
    for (wrapper, required) in [
        ("mokly-ignore", "id='clock'"),
        ("mokly-ignore-scope", "enabled='true'"),
    ] {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("specs")).unwrap();
        fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
        fs::write(
            root.path().join("specs/panel.component.html"),
            "---\ntitle: Panel\nelement: ui-panel\npropSchema: {type: object, additionalProperties: false, properties: {}}\nslots: [children, named]\n---\n<article><section><slot></slot></section><aside><slot name='named'></slot></aside></article>",
        )
        .unwrap();
        fs::write(
            root.path().join("specs/home.screen.html"),
            format!(
                "---\ntitle: Home\n---\n<ui-panel><{wrapper} {required} {attribute}><p>Clock</p></{wrapper}><p slot='named'>Named</p></ui-panel>"
            ),
        )
        .unwrap();
        let output = Command::new(env!("CARGO_BIN_EXE_mokly"))
            .args(["build", "--no-changes", "--out", "site"])
            .current_dir(root.path())
            .env("MOKLY_OUTPUT", "plain")
            .env("PATH", "")
            .env(
                "MOKLY_PACKAGE_ROOT",
                Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly"),
            )
            .output()
            .unwrap();
        let stderr = String::from_utf8(output.stderr).unwrap();
        assert!(output.status.success(), "{wrapper} {attribute}: {stderr}");
        assert_eq!(stderr.matches("[mokly/warning]").count(), 1, "{stderr}");
        assert!(stderr.contains(&format!(
            "unknown attribute {name} on <{wrapper}> is ignored"
        )));
        let html = fs::read_to_string(
            root.path()
                .join("site/static/mokly-generated/home/index.mobile.html"),
        )
        .unwrap();
        let children = html
            .split_once("<section>")
            .unwrap()
            .1
            .split_once("</section>")
            .unwrap()
            .0;
        let named = html
            .split_once("<aside>")
            .unwrap()
            .1
            .split_once("</aside>")
            .unwrap()
            .0;
        assert!(children.contains("<p>Clock</p>"), "{html}");
        assert!(!children.contains("Named"), "{html}");
        assert!(named.contains("<p>Named</p>"), "{html}");
        assert!(!named.contains("Clock"), "{html}");
        assert!(!html.contains("mokly-ignore"), "{html}");
    }
}
