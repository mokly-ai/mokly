//! Static Changes maps surviving entries to changed when their color schemes change.

use mokly_test_support::changes::{self, screen};
use mokly_test_support::files::write;
use mokly_test_support::git::{commit_all, git};
use mokly_test_support::publication;
use serde_json::{Value, json};

use super::support::mokly;

fn config(schemes: &[&str]) -> String {
    json!({ "colorSchemes": schemes, "review": { "base": "fixture-base" } }).to_string()
}

fn home(schemes: &[&str]) -> String {
    screen(
        "<h1>Home</h1>",
        &format!("colorSchemes: {}\n", json!(schemes)),
    )
}

fn card(schemes: Option<&[&str]>) -> String {
    let schemes = schemes.map_or(String::new(), |schemes| {
        format!("colorSchemes: {}\n", json!(schemes))
    });
    format!(
        "---\ntitle: Card\nelement: ui-card\n{schemes}propSchema: {{type: object, additionalProperties: false, properties: {{}}}}\n---\n<p>Card</p>"
    )
}

fn scheme_change(scenario: &str) {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    let adding = scenario.starts_with("add-");
    let global = scenario == "global" || scenario == "add-global";
    let component = scenario == "component" || scenario == "add-component";
    let both: &[&str] = &["light", "dark"];
    let light: &[&str] = &["light"];
    write(
        path,
        "mokly.config.json",
        config(if scenario == "add-global" {
            light
        } else {
            both
        }),
    );
    write(
        path,
        "specs/home.screen.html",
        home(if adding { light } else { both }),
    );
    write(
        path,
        "specs/card.component.html",
        card(Some(if adding { light } else { both })),
    );
    write(path, "specs/note.md", "# Note\n\nSame content\n");
    if global {
        write(path, "specs/home.screen.html", screen("<h1>Home</h1>", ""));
        write(path, "specs/card.component.html", card(None));
    }
    commit_all(path, "base schemes");
    git(path, &["branch", "fixture-base"]);
    if global {
        write(
            path,
            "mokly.config.json",
            config(if adding { both } else { light }),
        );
    } else if component {
        write(
            path,
            "specs/card.component.html",
            card(Some(if adding { both } else { light })),
        );
    } else {
        write(
            path,
            "specs/home.screen.html",
            home(if scenario == "add-screen" {
                both
            } else {
                light
            }),
        );
    }
    let built = changes::build(&mokly(), path, &[], "rich");
    let index = &built.index;
    let lists: &[&str] = if component {
        &["components"]
    } else if global {
        &["screens", "documents", "components"]
    } else {
        &["screens"]
    };
    assert_eq!(index["changesStatus"], "ready");
    assert_eq!(index["removedEntries"], json!([]));
    let entries: Vec<&Value> = lists
        .iter()
        .flat_map(|list| index[*list].as_array().unwrap())
        .collect();
    for entry in entries {
        assert_eq!(
            entry["changes"],
            json!({ "status": "ready", "kind": "changed", "included": true })
        );
        if let Some(comparison) = entry.get("comparison") {
            assert_eq!(
                comparison,
                &json!({ "status": "ready", "kind": "changed", "eligible": true })
            );
        }
        for view in entry
            .get("views")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            assert_eq!(view["comparison"]["status"], "ready");
            assert_eq!(view["comparison"]["eligible"], false);
            let kind = if view["colorScheme"] == "dark" {
                "added"
            } else {
                "unmodified"
            };
            assert_eq!(view["comparison"]["kind"], kind);
        }
    }
}

#[test]
fn static_changes_maps_surviving_entries_to_changed_when_schemes_change_screen() {
    scheme_change("screen");
}

#[test]
fn static_changes_maps_surviving_entries_to_changed_when_schemes_change_component() {
    scheme_change("component");
}

#[test]
fn static_changes_maps_surviving_entries_to_changed_when_schemes_change_global() {
    scheme_change("global");
}

#[test]
fn static_changes_maps_surviving_entries_to_changed_when_schemes_change_add_screen() {
    scheme_change("add-screen");
}

#[test]
fn static_changes_maps_surviving_entries_to_changed_when_schemes_change_add_component() {
    scheme_change("add-component");
}

#[test]
fn static_changes_maps_surviving_entries_to_changed_when_schemes_change_add_global() {
    scheme_change("add-global");
}
