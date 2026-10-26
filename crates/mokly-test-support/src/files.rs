//! File helpers: write nested files and read a complete directory tree.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
#[cfg(windows)]
use std::process::Command;

/// Write `contents` to `root/name`, and create the parent folders.
pub fn write(root: &Path, name: &str, contents: impl AsRef<[u8]>) {
    let path = root.join(name);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(path, contents).unwrap();
}

/// Read every file below `root`, keyed by its relative path with `/` separators.
///
/// A symbolic link to a file is read through the link.
pub fn tree(root: &Path) -> BTreeMap<String, Vec<u8>> {
    let mut files = BTreeMap::new();
    walk(root, "", &mut files);
    files
}

fn walk(directory: &Path, prefix: &str, files: &mut BTreeMap<String, Vec<u8>>) {
    for entry in fs::read_dir(directory).unwrap() {
        let entry = entry.unwrap();
        let name = format!("{prefix}{}", entry.file_name().to_string_lossy());
        if entry.file_type().unwrap().is_dir() {
            walk(&entry.path(), &format!("{name}/"), files);
        } else {
            files.insert(name, fs::read(entry.path()).unwrap());
        }
    }
}

/// Link the folder `link` to the folder `target`: a symbolic link on Unix and a
/// junction on Windows.
pub fn link_directory(target: &Path, link: &Path) {
    #[cfg(unix)]
    std::os::unix::fs::symlink(target, link).unwrap();
    #[cfg(windows)]
    {
        let status = Command::new("cmd")
            .arg("/C")
            .arg("mklink")
            .arg("/J")
            .arg(link)
            .arg(target)
            .status()
            .unwrap();
        assert!(status.success(), "mklink /J {}", link.display());
    }
}
