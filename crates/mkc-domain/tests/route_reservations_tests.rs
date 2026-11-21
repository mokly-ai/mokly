//! Cross-source route ownership and workspace-reservation drift checks.

#![allow(clippy::expect_used, clippy::panic)]

use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use mkc_domain::slug::{
    APP_FIRST_SEGMENTS, EXPLICIT_SITE_FIRST_SEGMENTS, EXPO_STATIC_FIRST_SEGMENTS,
    POLICY_RESERVED_SLUGS, SITE_FIRST_SEGMENTS, github_reserved_slugs, is_reserved,
};

fn repository() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

struct RouteFixture(PathBuf);

impl Drop for RouteFixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn route_fixture() -> RouteFixture {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    let root = env::temp_dir().join(format!("mkc-route-reservations-{nonce}"));
    fs::create_dir(&root).expect("create route fixture");
    RouteFixture(root)
}

fn entries(directory: &Path) -> Vec<fs::DirEntry> {
    fs::read_dir(directory)
        .unwrap_or_else(|error| panic!("read {}: {error}", directory.display()))
        .map(|entry| entry.expect("read directory entry"))
        .collect()
}

fn route_stem(path: &Path) -> Option<String> {
    let file = path.file_name()?.to_str()?;
    let mut stem = [".tsx", ".jsx", ".ts", ".js"]
        .iter()
        .find_map(|extension| file.strip_suffix(extension))?;
    for platform in [".web", ".native", ".ios", ".android"] {
        if let Some(value) = stem.strip_suffix(platform) {
            stem = value;
            break;
        }
    }
    (!matches!(stem, "index" | "_layout") && !stem.starts_with('[') && !stem.starts_with('+'))
        .then(|| stem.to_owned())
}

fn contains_route(directory: &Path) -> bool {
    entries(directory).into_iter().any(|entry| {
        let path = entry.path();
        if path.is_dir() {
            contains_route(&path)
        } else {
            let file = path.file_name().and_then(|name| name.to_str());
            let supported = [".tsx", ".jsx", ".ts", ".js"]
                .iter()
                .any(|extension| file.is_some_and(|name| name.ends_with(extension)));
            supported
                && !file.is_some_and(|name| name.starts_with("_layout.") || name.starts_with('+'))
        }
    })
}

fn collect_expo_roots(directory: &Path, roots: &mut BTreeSet<String>) {
    for entry in entries(directory) {
        let path = entry.path();
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            panic!("non-UTF-8 Expo route name: {}", path.display());
        };
        if path.is_file() {
            if let Some(stem) = route_stem(&path) {
                roots.insert(stem);
            }
        } else if name.starts_with('(') && name.ends_with(')') {
            collect_expo_roots(&path, roots);
        } else if !name.starts_with('[')
            && !name.starts_with('+')
            && name != "_layout"
            && contains_route(&path)
        {
            roots.insert(name);
        }
    }
}

fn declaration<'a>(source: &'a str, name: &str, open: char, close: char) -> &'a str {
    let marker = format!("const {name}");
    let start = source
        .find(&marker)
        .unwrap_or_else(|| panic!("missing TypeScript declaration {name}"));
    let relative_open = source[start..]
        .find(open)
        .unwrap_or_else(|| panic!("missing {open} for {name}"));
    let open_index = start + relative_open;
    let mut depth = 0_u32;
    let mut quote = None;
    let mut escaped = false;
    for (offset, character) in source[open_index..].char_indices() {
        if let Some(active) = quote {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == active {
                quote = None;
            }
            continue;
        }
        if matches!(character, '\'' | '"' | '`') {
            quote = Some(character);
        } else if character == open {
            depth += 1;
        } else if character == close {
            depth -= 1;
            if depth == 0 {
                return &source[open_index + 1..open_index + offset];
            }
        }
    }
    panic!("unterminated TypeScript declaration {name}")
}

fn quoted_values(source: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut characters = source.chars().peekable();
    while let Some(character) = characters.next() {
        if !matches!(character, '\'' | '"' | '`') {
            continue;
        }
        let quote = character;
        let mut value = String::new();
        while let Some(next) = characters.next() {
            if next == '\\' {
                value.push(characters.next().expect("escaped string character"));
            } else if next == quote {
                break;
            } else {
                value.push(next);
            }
        }
        values.push(value);
    }
    values
}

fn typescript_site_segments() -> BTreeSet<String> {
    let source = fs::read_to_string(repository().join("apps/site/src/navigation.ts"))
        .expect("read site navigation");
    let mut segments = BTreeSet::new();
    for route in quoted_values(declaration(&source, "SITE_PATHS", '{', '}')) {
        assert!(
            route.starts_with('/'),
            "site route is not absolute: {route}"
        );
        if let Some(segment) = route.split('/').find(|part| !part.is_empty()) {
            segments.insert(segment.to_owned());
        }
    }
    segments.extend(quoted_values(declaration(
        &source,
        "SITE_OUTPUT_FIRST_SEGMENTS",
        '[',
        ']',
    )));
    segments
}

fn worker_site_segments() -> BTreeSet<String> {
    let source = fs::read_to_string(repository().join("apps/worker/src/site-segments.ts"))
        .expect("read generated Worker site segments");
    quoted_values(declaration(&source, "SITE_FIRST_SEGMENTS", '[', ']'))
        .into_iter()
        .collect()
}

#[test]
fn expo_static_roots_match_the_reserved_domain_inventory() {
    let mut routes = BTreeSet::new();
    collect_expo_roots(&repository().join("packages/app/app"), &mut routes);
    let declared = EXPO_STATIC_FIRST_SEGMENTS
        .iter()
        .map(ToString::to_string)
        .collect::<BTreeSet<_>>();
    assert_eq!(
        routes, declared,
        "Expo route tree and domain inventory drifted"
    );

    let app = APP_FIRST_SEGMENTS.iter().copied().collect::<BTreeSet<_>>();
    for route in &routes {
        assert!(app.contains(route.as_str()), "app reserve missing {route}");
        assert!(is_reserved(route), "workspace reserve missing {route}");
    }
}

#[test]
fn expo_discovery_flattens_groups_and_ignores_special_or_dynamic_roots() {
    let fixture = route_fixture();
    for file in [
        "_layout.tsx",
        "index.tsx",
        "+not-found.tsx",
        "dashboard.web.tsx",
        "(account)/index.tsx",
        "(account)/sign-in.tsx",
        "(product)/settings/index.tsx",
        "[workspace]/index.tsx",
        "layout-only/_layout.tsx",
    ] {
        let path = fixture.0.join(file);
        fs::create_dir_all(path.parent().expect("route fixture parent"))
            .expect("create nested route fixture");
        fs::write(path, "export default function Route() {}").expect("write route fixture");
    }
    let mut roots = BTreeSet::new();
    collect_expo_roots(&fixture.0, &mut roots);
    assert_eq!(
        roots,
        BTreeSet::from([
            "dashboard".to_owned(),
            "settings".to_owned(),
            "sign-in".to_owned(),
        ])
    );
}

#[test]
fn site_navigation_worker_and_optional_build_outputs_match() {
    let navigation = typescript_site_segments();
    let worker = worker_site_segments();
    let domain = SITE_FIRST_SEGMENTS
        .iter()
        .map(ToString::to_string)
        .collect::<BTreeSet<_>>();
    assert_eq!(
        navigation, worker,
        "site navigation and Worker module drifted"
    );
    assert_eq!(
        navigation, domain,
        "site navigation and domain inventory drifted"
    );

    let dist = repository().join("apps/site/dist");
    if dist.exists() {
        let ignored = BTreeSet::from(["404.html", "_headers", "index.html"]);
        let built = entries(&dist)
            .into_iter()
            .filter_map(|entry| entry.file_name().to_str().map(str::to_owned))
            .filter(|name| !ignored.contains(name.as_str()))
            .collect::<BTreeSet<_>>();
        assert_eq!(built, domain, "site build root names drifted");
    }
}

#[test]
fn every_declared_route_and_policy_name_is_reserved() {
    for value in SITE_FIRST_SEGMENTS
        .iter()
        .chain(EXPLICIT_SITE_FIRST_SEGMENTS)
        .chain(EXPO_STATIC_FIRST_SEGMENTS)
        .chain(APP_FIRST_SEGMENTS)
        .chain(POLICY_RESERVED_SLUGS)
        .copied()
        .chain(github_reserved_slugs())
    {
        assert!(!value.is_empty(), "empty reserved name");
        assert!(is_reserved(value), "declared name is not reserved: {value}");
    }
}

#[test]
fn reservation_groups_are_sorted_and_unique() {
    for (name, values) in [
        ("site", SITE_FIRST_SEGMENTS),
        ("explicit site", EXPLICIT_SITE_FIRST_SEGMENTS),
        ("Expo", EXPO_STATIC_FIRST_SEGMENTS),
        ("app", APP_FIRST_SEGMENTS),
        ("policy", POLICY_RESERVED_SLUGS),
    ] {
        assert!(
            values.windows(2).all(|pair| pair[0] < pair[1]),
            "{name} reservations must be sorted and unique: {values:?}"
        );
    }
}
