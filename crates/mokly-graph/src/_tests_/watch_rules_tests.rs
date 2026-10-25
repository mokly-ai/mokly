//! Watch input identities use portable paths independently of host separators.

use std::collections::BTreeMap;
use std::path::Path;

use mokly_catalogue::config_types::{Config, ResolvedConfig, WatchAction, WatchConfig, WatchRule};
use mokly_model::material::digest;
use mokly_source_interface::tree::{Child, FileKind, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::watch_rules;

#[test]
fn nested_watch_input_hashes_have_the_same_posix_keys_on_every_host() {
    let tree = Unimock::new((
        SourceTreeMock::children
            .next_call(matching!((path) if *path == Path::new("/repo")))
            .returns(Ok(vec![Child {
                name: "data".into(),
                kind: FileKind::Directory,
            }])),
        SourceTreeMock::children
            .next_call(matching!((path) if *path == Path::new("/repo/data")))
            .returns(Ok(vec![Child {
                name: "input.txt".into(),
                kind: FileKind::File,
            }])),
        SourceTreeMock::digest
            .next_call(matching!((path) if *path == Path::new("/repo/data/input.txt")))
            .returns(Ok("content-hash".into())),
    ));
    let config = ResolvedConfig {
        input: Config {
            watch: Some(WatchConfig {
                debounce_ms: None,
                rules: Some(vec![WatchRule {
                    action: WatchAction::Rebuild,
                    paths: vec!["data/**/*.txt".into()],
                }]),
            }),
            ..Default::default()
        },
        file: "/repo/mokly.config.json".into(),
        repo_root: "/repo".into(),
        authored_inputs: Vec::new(),
        roots: Vec::new(),
    };
    let expected = BTreeMap::from([("data/input.txt", "content-hash")]);
    assert_eq!(
        watch_rules::inputs(&config, &tree, &[]).unwrap(),
        (digest(format!("{expected:?}").as_bytes()), digest(b"{}"))
    );
}
