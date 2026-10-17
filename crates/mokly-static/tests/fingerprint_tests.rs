//! Live fingerprints protect selected files and ignore unrelated paths and links.

use std::fs;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_source_interface::tree::SourceTree;
use mokly_static::error::Error;
use mokly_static::fingerprint::{CapturedTree, InputTree};
use tempfile::TempDir;

fn fixture() -> (TempDir, ResolvedConfig) {
    let temporary = TempDir::new().unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    fs::create_dir(root.join("specs")).unwrap();
    fs::write(root.join("mokly.config.json"), "{}").unwrap();
    let config = ResolvedConfig {
        input: Config::default(),
        file: root.join("mokly.config.json"),
        repo_root: root.clone(),
        authored_inputs: vec![],
        roots: vec![ResolvedRoot {
            input: RootConfig {
                dir: "specs".into(),
                files: None,
                path: None,
                transparent: None,
            },
            directory: root.join("specs"),
            identity: root.join("specs"),
        }],
    };
    (temporary, config)
}

#[test]
fn explicit_hidden_inputs_and_new_root_members_are_rechecked() {
    let (_temporary, config) = fixture();
    let root = &config.repo_root;
    fs::create_dir(root.join(".context")).unwrap();
    let input = root.join(".context/helper.ts");
    fs::write(&input, "original").unwrap();
    let tree = CapturedTree::new(Arc::new(WorkingTree));
    tree.begin(&config, &[]).unwrap();
    assert_eq!(tree.read(&input).unwrap(), b"original");
    fs::write(&input, "changed").unwrap();
    assert_eq!(tree.read(&input).unwrap(), b"original");
    assert!(tree.verify().is_err());
    let tree = CapturedTree::new(Arc::new(WorkingTree));
    tree.begin(&config, &[]).unwrap();
    fs::write(root.join("specs/new.screen.html"), "new").unwrap();
    assert!(matches!(tree.verify(), Err(Error::InputsChanged { path })
        if path == root.join("specs/new.screen.html")));
}

#[test]
fn every_selected_kind_is_rechecked_while_unrelated_edits_are_ignored() {
    for changed in [
        "mokly.config.json",
        "renderer.ts",
        "theme.css",
        "specs/home.screen.html",
        "specs/_folder.json",
        ".context/import.ts",
        "assets/logo.svg",
        "unrelated.txt",
        "specs/unmatched.txt",
    ] {
        let (_temporary, mut config) = fixture();
        let root = &config.repo_root;
        for file in [
            "renderer.ts",
            "theme.css",
            "specs/home.screen.html",
            "specs/_folder.json",
            ".context/import.ts",
            "assets/logo.svg",
            "unrelated.txt",
            "specs/unmatched.txt",
        ] {
            let path = root.join(file);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, "before").unwrap();
        }
        config.authored_inputs = vec![root.join("renderer.ts"), root.join("theme.css")];
        let tree = CapturedTree::new(Arc::new(WorkingTree));
        tree.begin(&config, &[]).unwrap();
        tree.capture(root, &[".context/import.ts".into()]).unwrap();
        tree.read_public(&root.join("assets/logo.svg")).unwrap();
        tree.project(&root.join("unrelated.txt")).unwrap();
        tree.verify().unwrap();
        fs::write(root.join(changed), "after").unwrap();
        if matches!(changed, "unrelated.txt" | "specs/unmatched.txt") {
            tree.verify().unwrap();
        } else {
            assert!(
                matches!(tree.verify(), Err(Error::InputsChanged { path })
                if path == root.join(changed)),
                "{changed}"
            );
        }
    }
}

#[cfg(unix)]
#[test]
fn escaping_dangling_and_cyclic_links_outside_selected_inputs_are_ignored() {
    let (_temporary, config) = fixture();
    let root = &config.repo_root;
    let outside = TempDir::new().unwrap();
    fs::write(outside.path().join("secret.screen.html"), "never read").unwrap();
    let specs = root.join("specs");
    std::os::unix::fs::symlink(outside.path(), specs.join("outside")).unwrap();
    std::os::unix::fs::symlink("absent", specs.join("dangling.screen.html")).unwrap();
    std::os::unix::fs::symlink(&specs, specs.join("cycle")).unwrap();
    let tree = CapturedTree::new(Arc::new(WorkingTree));
    tree.begin(&config, &[]).unwrap();
    fs::remove_file(specs.join("dangling.screen.html")).unwrap();
    std::os::unix::fs::symlink("another", specs.join("dangling.screen.html")).unwrap();
    fs::write(outside.path().join("secret.screen.html"), "changed").unwrap();
    tree.verify().unwrap();
}

#[cfg(unix)]
#[test]
fn canonical_output_exclusion_also_excludes_a_different_logical_alias() {
    let (_temporary, mut config) = fixture();
    let root = config.repo_root.clone();
    let specs = root.join("specs");
    let output = specs.join("site");
    fs::create_dir(&output).unwrap();
    std::os::unix::fs::symlink(&specs, root.join("logical")).unwrap();
    std::os::unix::fs::symlink(&output, specs.join("alias")).unwrap();
    config.roots[0].directory = root.join("logical");
    let tree = CapturedTree::new(Arc::new(WorkingTree));
    tree.begin(&config, std::slice::from_ref(&output)).unwrap();
    fs::write(output.join("index.screen.html"), "site").unwrap();
    tree.verify().unwrap();
}

#[cfg(unix)]
#[test]
fn a_selected_alias_retarget_is_detected_even_when_both_files_have_equal_bytes() {
    let (_temporary, config) = fixture();
    let root = &config.repo_root;
    let first = root.join("first.txt");
    let second = root.join("second.txt");
    fs::write(&first, "same").unwrap();
    fs::write(&second, "same").unwrap();
    let alias = root.join("alias.txt");
    std::os::unix::fs::symlink(&first, &alias).unwrap();
    let tree = CapturedTree::new(Arc::new(WorkingTree));
    tree.begin(&config, &[]).unwrap();
    tree.capture(root, &["alias.txt".into()]).unwrap();
    fs::remove_file(&alias).unwrap();
    std::os::unix::fs::symlink(&second, &alias).unwrap();
    assert!(matches!(tree.verify(), Err(Error::InputsChanged { path }) if path == alias));
}
