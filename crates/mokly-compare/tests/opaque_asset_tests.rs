//! Real Git metadata, converted digests, and delivery share nested opaque asset paths.

use std::sync::Arc;

use mokly_compare::git_tree::GitTree;
use mokly_compare::sources::GitSources;
use mokly_css::compiler::Compiler;
use mokly_css::resolver::SourceResolver;
use mokly_css::types::{IdentityProcessor, StylesheetBundler, StylesheetRoot};
use mokly_git::disk::SystemDisk;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::tree::Limits;
use mokly_model::material::digest;
use mokly_source_interface::tree::SourceTree;

#[expect(dead_code, reason = "this case needs only the fixture repository")]
mod engine_support;
use engine_support::{Fixture, runner};

#[test]
fn a_base_stylesheet_batches_nested_assets_and_delivers_their_converted_bytes() {
    let fixture = Fixture::new(&[
        (".gitattributes", "*.svg text eol=crlf\n"),
        (
            "assets/styles.css",
            ".a{background:url('./img/a.svg')} .b{background:url('./nested/img/b.svg')}",
        ),
        ("assets/img/a.svg", "<svg>a</svg>\n"),
        ("assets/nested/img/b.svg", "<svg>b</svg>\n"),
    ]);
    let root = fixture.directory.path();
    let repository = GitRepositories {
        runner: runner(),
        disk: Arc::new(SystemDisk),
    }
    .open(root)
    .unwrap();
    let tree: Arc<dyn SourceTree> = Arc::new(GitTree::new(
        root.into(),
        Arc::new(GitSources::new(
            repository,
            fixture.commit.clone(),
            Limits::default(),
        )),
        4096,
    ));
    let compiler = Compiler {
        tree: tree.clone(),
        repo_root: root.into(),
        resolver: Arc::new(SourceResolver {
            settings: Default::default(),
            tree: tree.clone(),
            repo_root: root.into(),
        }),
        processor: Arc::new(IdentityProcessor),
    };
    let bundle = compiler
        .bundle(&StylesheetRoot {
            path: "assets/styles.css".into(),
            stylesheets: vec!["assets/styles.css".into()],
            excluded: Default::default(),
            local_css: true,
        })
        .unwrap();
    assert_eq!(bundle.assets.len(), 2);
    for (route, bytes) in [
        ("assets/assets/img/a.svg", b"<svg>a</svg>\r\n".as_slice()),
        (
            "assets/assets/nested/img/b.svg",
            b"<svg>b</svg>\r\n".as_slice(),
        ),
    ] {
        let asset = &bundle.assets[route];
        assert_eq!(asset.digest, digest(bytes));
        let mut stream = tree.open_stream(&asset.source).unwrap();
        assert_eq!(stream.length(), bytes.len() as u64);
        let mut output = Vec::new();
        stream
            .copy_verified(&asset.source, &asset.digest, &mut output)
            .unwrap();
        assert_eq!(output, bytes);
    }
}
