//! Runtime seams use unimock and operation counts without disk or clock access.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_html::fragment::{
    Fragment, FragmentRenderer, FragmentRendererMock, FragmentRequest, RenderKind,
};
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_source_interface::tree::{FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::cache::{MemoryCache, RenderCache};
use crate::fragments::MemoFragments;
use crate::policy::{FilePolicy, PublicPolicy};
use crate::public_denial::PublicDenial;
use crate::source_snapshot::SourceSnapshot;

#[test]
fn a_source_snapshot_reads_each_input_once_and_keeps_generation_bytes() {
    let mock = Arc::new(Unimock::new(
        SourceTreeMock::read
            .next_call(matching!(_))
            .returns(Ok(b"frozen".to_vec())),
    ));
    let snapshot: &dyn SourceTree = &SourceSnapshot::new(mock);
    for _ in 0..4 {
        assert_eq!(
            snapshot.read(Path::new("/repo/input.css")).unwrap(),
            b"frozen"
        );
    }
}

#[test]
fn public_policy_caches_success_and_denial_and_allows_ordinary_browser_scripts() {
    let mock = Arc::new(Unimock::new((
        SourceTreeMock::project
            .next_call(matching!((path) if *path == Path::new("/repo/assets")))
            .returns(Ok(Some(Node {
                identity: "/repo/assets".into(),
                lexical_kind: FileKind::Directory,
                kind: FileKind::Directory,
            }))),
        SourceTreeMock::project
            .next_call(matching!((path) if *path == Path::new("/repo/assets/runtime.js")))
            .returns(Ok(Some(Node {
                identity: "/repo/assets/runtime.js".into(),
                lexical_kind: FileKind::File,
                kind: FileKind::File,
            }))),
        SourceTreeMock::project
            .next_call(matching!((path) if *path == Path::new("/repo/alias")))
            .returns(Ok(Some(Node {
                identity: "/repo/assets".into(),
                lexical_kind: FileKind::Symlink,
                kind: FileKind::Directory,
            }))),
        SourceTreeMock::project
            .next_call(matching!((path) if *path == Path::new("/repo/alias/runtime.js")))
            .returns(Ok(Some(Node {
                identity: "/repo/assets/runtime.js".into(),
                lexical_kind: FileKind::File,
                kind: FileKind::File,
            }))),
        SourceTreeMock::project
            .next_call(matching!((path) if *path == Path::new("/repo/inputs/private.js")))
            .returns(Ok(Some(Node {
                identity: "/repo/inputs/private.js".into(),
                lexical_kind: FileKind::File,
                kind: FileKind::File,
            }))),
    )));
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    let policy: &dyn PublicPolicy = &FilePolicy::new(
        mock,
        &config,
        &["inputs/private.js".into()],
        BTreeMap::new(),
        Some(Path::new("/repo/site")),
    )
    .unwrap();
    for _ in 0..4 {
        assert_eq!(
            policy.check("assets/runtime.js").unwrap().path,
            "assets/runtime.js"
        );
        assert_eq!(
            policy.check("alias/runtime.js").unwrap_err(),
            PublicDenial::Symlink
        );
        assert_eq!(
            policy.check("inputs/private.js").unwrap_err(),
            PublicDenial::Listed
        );
        assert_eq!(
            policy.check("site/file.html").unwrap_err(),
            PublicDenial::Private
        );
        assert_eq!(
            policy.check(".secret/key").unwrap_err(),
            PublicDenial::Hidden
        );
        assert_eq!(
            policy.check("node_modules/browser.js").unwrap_err(),
            PublicDenial::Dependency
        );
    }
}

#[test]
fn fragment_cache_reuses_equal_props_and_separates_ignore_scope() {
    let renderer = Arc::new(Unimock::new((
        FragmentRendererMock::render
            .next_call(matching!((request) if request.ignore_enabled))
            .returns(Ok(Fragment {
                html: "<p>enabled</p>".into(),
                ..Default::default()
            })),
        FragmentRendererMock::render
            .next_call(matching!((request) if !request.ignore_enabled))
            .returns(Ok(Fragment {
                html: "<p>disabled</p>".into(),
                ..Default::default()
            })),
    )));
    let cache: Arc<dyn RenderCache> = Arc::new(MemoryCache::new(1024 * 1024));
    let memo: &dyn FragmentRenderer =
        &MemoFragments::new("generation".into(), renderer, cache.clone());
    let mut request = FragmentRequest {
        entry_path: "components/chip".into(),
        entry_title: "Chip".into(),
        saved_slots: Default::default(),
        handle: "button.mockup.tsx#Button".into(),
        kind: RenderKind::Component,
        props: BTreeMap::new(),
        viewport: Viewport::Mobile,
        color_scheme: ColorScheme::Light,
        ignore_enabled: true,
        slots: BTreeMap::new(),
    };
    for _ in 0..4 {
        assert_eq!(memo.render(&request).unwrap().html, "<p>enabled</p>");
    }
    request.ignore_enabled = false;
    assert_eq!(memo.render(&request).unwrap().html, "<p>disabled</p>");
    assert!(cache.stats().hits >= 3);
    assert_eq!(cache.stats().entries, 2);
}
