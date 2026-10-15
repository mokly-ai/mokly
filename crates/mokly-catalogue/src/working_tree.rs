//! Working-tree adapter. Discovery itself never reads the disk.

use std::fs::{self, FileType};
use std::io;
use std::path::Path;

use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTree};

/// Source tree backed by the host filesystem.
pub struct WorkingTree;

impl SourceTree for WorkingTree {
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        let lexical_kind = match fs::symlink_metadata(path) {
            Ok(metadata) => kind(metadata.file_type()),
            Err(source) => {
                let error = SourceError::Io {
                    operation: "stat lexical node",
                    path: path.into(),
                    source,
                };
                return if error.is_vanished() {
                    Ok(None)
                } else {
                    Err(error)
                };
            }
        };
        let identity = match fs::canonicalize(path) {
            Ok(identity) => identity,
            Err(source) => {
                let error = SourceError::Io {
                    operation: "project",
                    path: path.into(),
                    source,
                };
                return if error.is_vanished() {
                    Ok(None)
                } else {
                    Err(error)
                };
            }
        };
        match fs::metadata(&identity) {
            Ok(metadata) => Ok(Some(Node {
                identity,
                lexical_kind,
                kind: kind(metadata.file_type()),
            })),
            Err(source) => {
                let error = SourceError::Io {
                    operation: "stat",
                    path: path.into(),
                    source,
                };
                if error.is_vanished() {
                    Ok(None)
                } else {
                    Err(error)
                }
            }
        }
    }

    fn children(&self, path: &Path) -> Result<Vec<Child>> {
        let lexical = match fs::symlink_metadata(path) {
            Ok(metadata) => metadata,
            Err(source) => {
                return Err(SourceError::Io {
                    operation: "stat directory",
                    path: path.into(),
                    source,
                });
            }
        };
        if !lexical.is_dir() || lexical.file_type().is_symlink() {
            return Err(SourceError::Io {
                operation: "list directory",
                path: path.into(),
                source: io::Error::from(io::ErrorKind::NotADirectory),
            });
        }
        let entries = match fs::read_dir(path) {
            Ok(entries) => entries,
            Err(source) => {
                return Err(SourceError::Io {
                    operation: "list",
                    path: path.into(),
                    source,
                });
            }
        };
        let mut children = Vec::new();
        for entry in entries {
            let entry = match entry {
                Ok(entry) => entry,
                Err(source) => {
                    return Err(SourceError::Io {
                        operation: "list child",
                        path: path.into(),
                        source,
                    });
                }
            };
            let name = match entry.file_name().into_string() {
                Ok(name) => name,
                Err(_) => {
                    return Err(SourceError::Io {
                        operation: "decode filename",
                        path: entry.path(),
                        source: std::io::Error::new(
                            std::io::ErrorKind::InvalidInput,
                            "filename is not UTF-8",
                        ),
                    });
                }
            };
            match entry.file_type() {
                Ok(file_type) => children.push(Child {
                    name,
                    kind: kind(file_type),
                }),
                Err(source) => {
                    let error = SourceError::Io {
                        operation: "stat child",
                        path: entry.path(),
                        source,
                    };
                    if !error.is_vanished() {
                        return Err(error);
                    }
                }
            }
        }
        Ok(children)
    }

    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        match fs::read(path) {
            Ok(bytes) => Ok(bytes),
            Err(source) => Err(SourceError::Io {
                operation: "read",
                path: path.into(),
                source,
            }),
        }
    }
}

fn kind(file_type: FileType) -> FileKind {
    if file_type.is_symlink() {
        FileKind::Symlink
    } else if file_type.is_file() {
        FileKind::File
    } else if file_type.is_dir() {
        FileKind::Directory
    } else {
        FileKind::Other
    }
}
