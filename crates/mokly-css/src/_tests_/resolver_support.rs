//! In-memory package files and links for CSS resolver tests.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::resolution::Resolution;
use crate::resolver::SourceResolver;

pub(super) fn resolver(files: &[&str]) -> SourceResolver {
    resolver_with_files(
        &files.iter().map(|file| (*file, "{}")).collect::<Vec<_>>(),
        &[],
    )
}

pub(super) fn resolver_with_files(
    files: &[(&str, &str)],
    links: &[(&str, &str)],
) -> SourceResolver {
    let root = Path::new("/repo");
    let files: BTreeMap<_, _> = files
        .iter()
        .map(|(file, contents)| (root.join(file), contents.as_bytes().to_vec()))
        .collect();
    let projection = files.clone();
    let links: Vec<_> = links
        .iter()
        .map(|(written, target)| (root.join(written), root.join(target)))
        .collect();
    let projected_links = links.clone();
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                let identity = linked(path, &projected_links);
                let link = projected_links.iter().any(|(written, _)| written == path);
                let kind = if link {
                    FileKind::Directory
                } else {
                    FileKind::File
                };
                Ok(
                    (link || projection.contains_key(&identity)).then_some(Node {
                        identity,
                        lexical_kind: if link { FileKind::Symlink } else { kind },
                        kind,
                    }),
                )
            })),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                Ok(files
                    .get(&linked(path, &links))
                    .cloned()
                    .unwrap_or_default())
            })),
    )));
    SourceResolver {
        tree,
        repo_root: "/repo".into(),
        settings: Resolution {
            config_directory: "apps/web".into(),
            aliases: BTreeMap::from([("theme-alias".into(), "theme".into())]),
            dependency_roots: vec![
                "node_modules/.mokly-roots/1".into(),
                "node_modules/.mokly-roots/2".into(),
            ],
            ..Default::default()
        },
    }
}

fn linked(path: &Path, links: &[(PathBuf, PathBuf)]) -> PathBuf {
    let mut identity = path.to_owned();
    for (written, target) in links {
        if let Ok(suffix) = identity.strip_prefix(written) {
            identity = target.join(suffix);
        }
    }
    identity
}
