//! Integration source adapter for host-independent catalogue fixtures.

use std::collections::{BTreeMap, BTreeSet};
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::definition_provider::DeferredDefinitions;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::error::Result;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder, PreparedCatalogue};
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTree};
use serde_json::{Value, json};

pub(super) fn prepare(fixture: &Value) -> Result<PreparedCatalogue> {
    let root = Path::new("/repo");
    let mut files = BTreeMap::<PathBuf, Vec<u8>>::new();
    files.insert(
        root.join("mokly.config.json"),
        fixture
            .get("config")
            .unwrap_or(&json!({}))
            .to_string()
            .into_bytes(),
    );
    for (path, text) in fixture["files"].as_object().unwrap() {
        files.insert(root.join(path), text.as_str().unwrap().as_bytes().to_vec());
    }
    let mut directories = BTreeSet::from([root.to_owned()]);
    for path in files.keys() {
        for parent in path
            .ancestors()
            .skip(1)
            .filter(|path| path.starts_with(root))
        {
            directories.insert(parent.to_owned());
        }
    }
    let tree: Arc<dyn SourceTree> = Arc::new(FixtureTree { files, directories });
    let config = Loader { tree: tree.clone() }.load(root, Some("mokly.config.json"))?;
    let builder: &dyn CatalogueBuilder = &Builder {
        tree: tree.clone(),
        discovery: Arc::new(Discoverer { tree }),
        definitions: Arc::new(DeferredDefinitions),
    };
    builder.prepare(&config, None)
}

struct FixtureTree {
    files: BTreeMap<PathBuf, Vec<u8>>,
    directories: BTreeSet<PathBuf>,
}

impl SourceTree for FixtureTree {
    fn project(&self, path: &Path) -> mokly_source_interface::error::Result<Option<Node>> {
        let kind = if self.files.contains_key(path) {
            FileKind::File
        } else if self.directories.contains(path) {
            FileKind::Directory
        } else {
            return Ok(None);
        };
        Ok(Some(Node {
            identity: path.into(),
            kind,
            lexical_kind: kind,
        }))
    }
    fn children(&self, path: &Path) -> mokly_source_interface::error::Result<Vec<Child>> {
        if !self.directories.contains(path) {
            return Err(missing(path));
        }
        Ok(self
            .files
            .keys()
            .map(|path| (path, FileKind::File))
            .chain(
                self.directories
                    .iter()
                    .map(|path| (path, FileKind::Directory)),
            )
            .filter(|(candidate, _)| candidate.parent() == Some(path))
            .map(|(candidate, kind)| Child {
                name: candidate
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned(),
                kind,
            })
            .collect())
    }
    fn read(&self, path: &Path) -> mokly_source_interface::error::Result<Vec<u8>> {
        match self.files.get(path) {
            Some(bytes) => Ok(bytes.clone()),
            None => Err(missing(path)),
        }
    }
}

fn missing(path: &Path) -> SourceError {
    SourceError::Io {
        operation: "read virtual fixture",
        path: path.into(),
        source: io::Error::from(io::ErrorKind::NotFound),
    }
}
