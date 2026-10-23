//! Compiler boundaries use unimock; no unit test reads the filesystem.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::Arc;

use mokly_model::material::digest;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::compiler::Compiler;
use crate::resolver::{ImportResolverMock, SourceResolver};
use crate::types::{
    CssProcessorMock, IdentityProcessor, ProcessedCss, StylesheetBundler, StylesheetRoot,
};

fn root() -> StylesheetRoot {
    StylesheetRoot {
        path: "css/base.css".into(),
        stylesheets: vec!["css/base.css".into()],
        excluded: BTreeSet::new(),
        local_css: true,
    }
}

fn compiler(files: &[(&str, &str)], assets: bool) -> Compiler {
    let files: BTreeMap<_, _> = files
        .iter()
        .map(|(path, text)| (Path::new("/repo").join(path), text.as_bytes().to_vec()))
        .collect();
    let projection = files.clone();
    let hashes = files
        .iter()
        .map(|(path, bytes)| (path.clone(), digest(bytes)))
        .collect::<BTreeMap<_, _>>();
    let project = SourceTreeMock::project
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, path| {
            Ok((projection.contains_key(path)
                || projection
                    .keys()
                    .any(|candidate| candidate.starts_with(path)))
            .then(|| Node {
                identity: path.into(),
                lexical_kind: FileKind::File,
                kind: FileKind::File,
            }))
        }));
    let read = SourceTreeMock::read
        .each_call(matching!((path) if path.to_string_lossy().ends_with(".css")))
        .answers_arc(Arc::new(move |_, path| Ok(files[path].clone())));
    let mock = Arc::new(if assets {
        Unimock::new((
            project,
            read,
            SourceTreeMock::digest_unretained
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, path| Ok(hashes[path].clone()))),
        ))
    } else {
        Unimock::new((project, read))
    });
    Compiler {
        tree: mock.clone(),
        repo_root: "/repo".into(),
        resolver: Arc::new(SourceResolver {
            settings: Default::default(),
            tree: mock,
            repo_root: "/repo".into(),
        }),
        processor: Arc::new(IdentityProcessor),
    }
}

#[test]
fn imports_assets_and_modules_share_one_per_root_bundle() {
    let compiler = compiler(
        &[
            (
                "css/base.css",
                "@import './card.module.css'; .card { background:url('../images/a.svg?q#id') }",
            ),
            ("css/card.module.css", ".label { color:red }"),
            ("images/a.svg", "<svg/>"),
        ],
        true,
    );
    let bundle = compiler.bundle(&root()).unwrap();
    assert_eq!(bundle.route, "styles/css/base.css");
    assert!(bundle.css.ends_with('\n'));
    assert!(bundle.css.contains("../../assets/images/a.svg?q#id"));
    let asset = &bundle.assets["assets/images/a.svg"];
    assert_eq!(asset.path, "images/a.svg");
    assert_eq!(asset.source, Path::new("/repo/images/a.svg"));
    assert_eq!(asset.digest, digest(b"<svg/>"));
    assert!(asset.aliases.is_empty());
    assert!(
        bundle
            .css
            .contains(&bundle.css_modules["css/card.module.css"]["label"])
    );
    assert_eq!(bundle.inputs.len(), 2);
    assert!(!bundle.inputs.contains_key("images/a.svg"));
    insta::assert_snapshot!(bundle.css);
}

#[test]
fn invalid_css_assets_and_late_imports_fail_with_authored_paths() {
    for source in [
        ".x { background:url('/image.png') }",
        ".x { background:url('../missing.png') }",
        ".x { background:url('../images/a.txt') }",
        ".x { background:image-set('../images/a.svg' 1x) }",
        ".x {color:red} @import './late.css';",
    ] {
        let compiler = compiler(
            &[
                ("css/base.css", source),
                ("images/a.txt", "x"),
                ("images/a.svg", "<svg/>"),
                ("css/late.css", ".y{}"),
            ],
            false,
        );
        let error = compiler.bundle(&root()).unwrap_err().to_string();
        assert!(error.contains("css/base.css"), "{error}");
        assert!(!error.contains("/repo/"));
    }
}

#[test]
fn renderer_owned_imports_are_removed_before_postcss_is_called() {
    let mock = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(Some(Node {
                    identity: path.into(),
                    lexical_kind: FileKind::File,
                    kind: FileKind::File,
                }))
            }),
        SourceTreeMock::read
            .next_call(matching!((path) if *path == Path::new("/repo/css/base.css")))
            .returns(Ok(b"@import './renderer.css'; .x {color:red}".to_vec())),
        ImportResolverMock::resolve
            .next_call(matching!("css/base.css", "./renderer.css"))
            .returns(Ok("css/renderer.css".into())),
        CssProcessorMock::process
            .next_call(matching!(("css/base.css", text, _) if !text.contains("@import")))
            .answers(&|_, _, source, _| {
                Ok(ProcessedCss {
                    read_evidence: Default::default(),
                    text: source.into(),
                    inputs: BTreeMap::new(),
                    plugin_inputs: BTreeMap::new(),
                    directories: Vec::new(),
                })
            }),
    )));
    let compiler: &dyn StylesheetBundler = &Compiler {
        tree: mock.clone(),
        repo_root: "/repo".into(),
        resolver: mock.clone(),
        processor: mock,
    };
    let mut root = root();
    root.excluded.insert("css/renderer.css".into());
    assert!(!compiler.bundle(&root).unwrap().css.contains("@import"));
}
