//! Isolated real-IO integration fixture runner.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::definition_provider::DeferredDefinitions;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::error::Result;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder, PreparedCatalogue};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_source_interface::tree::SourceTree;

pub fn write(directory: &Path, path: &str, text: &str) {
    let path = directory.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

pub fn prepare(directory: &Path, explicit: Option<&str>) -> Result<PreparedCatalogue> {
    let tree: Arc<dyn SourceTree> = Arc::new(WorkingTree);
    let loader: &dyn ConfigLoader = &Loader { tree: tree.clone() };
    let config = loader.load(directory, explicit)?;
    let builder: &dyn CatalogueBuilder = &Builder {
        tree: tree.clone(),
        discovery: Arc::new(Discoverer { tree }),
        definitions: Arc::new(DeferredDefinitions),
    };
    builder.prepare(&config, None)
}
