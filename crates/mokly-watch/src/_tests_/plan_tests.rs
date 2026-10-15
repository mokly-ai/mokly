//! Pure watch plans prove denials, exact targets, and burst classifications.

use std::collections::BTreeSet;
use std::path::Path;

use mokly_catalogue::config_types::{
    Config, ResolvedConfig, ResolvedRoot, RootConfig, WatchAction, WatchConfig, WatchRule,
};
use mokly_css::dependencies::{DirectoryDependency, PluginInput};

use crate::event::{Action, Batch, Event, Kind};
use crate::plan::Plan;

fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config {
            watch: Some(WatchConfig {
                debounce_ms: Some(75.0),
                rules: Some(vec![
                    WatchRule {
                        action: WatchAction::Ignore,
                        paths: vec!["specs/**".into()],
                    },
                    WatchRule {
                        action: WatchAction::Reload,
                        paths: vec!["assets/**".into()],
                    },
                    WatchRule {
                        action: WatchAction::Rebuild,
                        paths: vec!["tokens/**".into()],
                    },
                ]),
            }),
            ..Default::default()
        },
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: vec![],
        roots: vec![root("specs"), root("dist/catalogue")],
    }
}
fn root(name: &str) -> ResolvedRoot {
    let directory = Path::new("/repo").join(name);
    ResolvedRoot {
        directory: directory.clone(),
        identity: directory,
        input: RootConfig {
            dir: name.into(),
            files: Some(vec!["**/*.html".into(), "**/target".into()]),
            path: None,
            transparent: None,
        },
    }
}
fn event(path: &str, kind: Kind) -> Event {
    Event {
        path: Path::new("/repo").join(path),
        kind,
    }
}

#[test]
fn exact_inputs_keep_denied_ancestors_and_rules_cannot_override_sources() {
    let plan = Plan::new(
        &config(),
        &["specs/target/private.js".into(), "specs/page.html".into()],
        &[],
        &BTreeSet::new(),
    )
    .unwrap();
    assert_eq!(
        plan.classify(&event("specs/page.html", Kind::File)),
        Some(Action::Rebuild)
    );
    assert_eq!(
        plan.classify(&event("specs/target/private.js", Kind::File)),
        Some(Action::Rebuild)
    );
    assert_eq!(
        plan.classify(&event("specs/target/created.html", Kind::File)),
        None
    );
    assert!(!plan.denied(Path::new("/repo/specs/target"), true));
    assert!(plan.denied(Path::new("/repo/specs/target/other"), true));
    assert_eq!(
        plan.classify(&event("specs/target", Kind::File)),
        Some(Action::Rebuild)
    );
    assert!(
        plan.targets()
            .contains(Path::new("/repo/specs/target/private.js"))
    );
    assert!(!plan.targets().contains(Path::new("/repo/specs/page.html")));
    assert_eq!(
        plan.classify(&event("mokly.config.json", Kind::File)),
        Some(Action::Config)
    );
}

#[test]
fn deepest_roots_are_waypoints_and_file_basenames_are_not_directories() {
    let mut config = config();
    config.roots.push(root(""));
    let plan = Plan::new(&config, &[], &[], &BTreeSet::new()).unwrap();
    assert!(!plan.denied(Path::new("/repo/dist"), true));
    assert!(!plan.denied(Path::new("/repo/dist/catalogue"), true));
    assert_eq!(
        plan.classify(&event("dist/catalogue/page.html", Kind::File)),
        Some(Action::Rebuild)
    );
    for path in [
        ".git",
        "node_modules",
        "specs/dist",
        "specs/.context",
        "mokly-static",
    ] {
        assert!(plan.denied(&Path::new("/repo").join(path), true), "{path}");
    }
    assert!(!plan.denied(Path::new("/repo/specs/target"), false));
    assert!(plan.denied(Path::new("/repo/specs/target"), true));
}

#[test]
fn directory_recipes_keep_empty_roots_and_accept_later_subdirectories() {
    let directory = DirectoryDependency {
        path: "content".into(),
        glob: "**/*.txt".into(),
        origin: PluginInput {
            plugin: "fixture".into(),
            stylesheet: "theme.css".into(),
        },
    };
    let plan = Plan::new(
        &config(),
        &["content/existing.txt".into()],
        &[directory],
        &BTreeSet::new(),
    )
    .unwrap();
    assert!(plan.targets().contains(Path::new("/repo/content")));
    assert!(
        !plan
            .targets()
            .contains(Path::new("/repo/content/existing.txt"))
    );
    assert_eq!(
        plan.classify(&event("content/added/new.txt", Kind::File)),
        Some(Action::Rebuild)
    );
    assert_eq!(
        plan.classify(&event("content/added/new.bin", Kind::File)),
        None
    );
    assert_eq!(
        plan.classify(&event("content/target/new.txt", Kind::File)),
        None
    );
}

#[test]
fn bursts_keep_the_latest_descriptor_every_path_and_the_strongest_action() {
    let plan = Plan::new(
        &config(),
        &[],
        &[],
        &BTreeSet::from(["assets/logo.svg".into()]),
    )
    .unwrap();
    let mut batch = Batch::default();
    for event in [
        event("assets/logo.svg", Kind::File),
        event("specs/home.html", Kind::File),
        event("mokly.config.json", Kind::File),
        event("assets/logo.svg", Kind::Rename),
    ] {
        let action = plan.classify(&event).unwrap();
        batch.insert(event, action);
    }
    assert_eq!(batch.action, Some(Action::Config));
    assert_eq!(batch.events.len(), 3);
    assert_eq!(
        batch.events[Path::new("/repo/assets/logo.svg")].kind,
        Kind::Rename
    );
    batch.rebuild();
    assert_eq!(batch.action, Some(Action::Config));
    assert_eq!(plan.classify(&event("unrelated.txt", Kind::File)), None);
}

#[test]
fn larger_reported_inventories_keep_the_same_effective_target_count() {
    let mut counts = Vec::new();
    for count in [256, 1024] {
        let sources: Vec<_> = (0..count)
            .map(|index| format!("content/file-{index}.txt"))
            .collect();
        let directory = DirectoryDependency {
            path: "content".into(),
            glob: "**/*.txt".into(),
            origin: PluginInput {
                plugin: "scan".into(),
                stylesheet: "theme.css".into(),
            },
        };
        let plan = Plan::new(&config(), &sources, &[directory], &BTreeSet::new()).unwrap();
        let targets = plan.targets();
        assert!(targets.contains(Path::new("/repo/content")));
        assert!(!targets.contains(Path::new("/repo/content/file-0.txt")));
        assert_eq!(plan.exact.len(), count + 1);
        counts.push(targets.len());
    }
    assert!(counts[0] > 0);
    assert_eq!(counts[0], counts[1]);
}

#[test]
fn explicit_rules_cannot_turn_denied_directories_into_roots() {
    let mut config = config();
    config.input.watch.as_mut().unwrap().rules = Some(vec![WatchRule {
        action: WatchAction::Rebuild,
        paths: vec![
            "specs/target/**".into(),
            ".git/refs/**".into(),
            "mokly-static/**".into(),
        ],
    }]);
    let plan = Plan::new(&config, &[], &[], &BTreeSet::new()).unwrap();
    for path in ["specs/target", ".git/refs", "mokly-static"] {
        assert!(!plan.targets().contains(&Path::new("/repo").join(path)));
        assert_eq!(
            plan.classify(&event(&format!("{path}/new.txt"), Kind::File)),
            None
        );
    }
}

#[test]
fn parent_directory_events_invalidate_required_descendants() {
    let plan = Plan::new(
        &config(),
        &["data/nested/source.txt".into()],
        &[],
        &BTreeSet::from(["assets/nested/logo.svg".into()]),
    )
    .unwrap();
    for kind in [Kind::Directory, Kind::File] {
        assert_eq!(
            plan.classify(&event("data/nested", kind)),
            Some(Action::Rebuild)
        );
        assert_eq!(
            plan.classify(&event("assets/nested", kind)),
            Some(Action::Reload)
        );
    }
}
