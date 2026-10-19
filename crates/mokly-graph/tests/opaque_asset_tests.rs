//! Opaque CSS resources retain one plan and reject stale or replaced delivery inputs.

use std::fs;
#[cfg(unix)]
use std::os::unix::net::UnixListener;
use std::path::Path;

use mokly_graph::error::GraphError;
use mokly_model::material::digest;
use tempfile::TempDir;

mod support;

fn fixture(roots: usize) -> TempDir {
    let directory = TempDir::new().unwrap();
    let root = directory.path();
    fs::create_dir(root.join("specs")).unwrap();
    fs::create_dir(root.join("assets")).unwrap();
    fs::write(
        root.join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<p>Home</p>",
    )
    .unwrap();
    let styles: Vec<_> = (0..roots)
        .map(|index| {
            let name = format!("assets/{index}.css");
            fs::write(root.join(&name), ".image{background:url('./image.svg')}").unwrap();
            name
        })
        .collect();
    fs::write(
        root.join("mokly.config.json"),
        serde_json::json!({"stylesheets": [{"match":"**","stylesheets":styles}]}).to_string(),
    )
    .unwrap();
    fs::write(root.join("assets/image.svg"), vec![b'x'; 128 * 1024]).unwrap();
    directory
}

#[test]
fn roots_share_one_asset_plan_and_delivery_uses_no_render_cache_entry() {
    for roots in [1, 4] {
        let directory = fixture(roots);
        let (generation, cache) = support::prepare(directory.path(), 1024 * 1024, 1);
        let generation = generation.unwrap();
        assert_eq!(
            generation
                .resource_routes()
                .iter()
                .filter(|route| route.starts_with("assets/"))
                .count(),
            1
        );
        assert_eq!(cache.stats().entries, roots);
        let expected = vec![b'x'; 128 * 1024];
        let hash = digest(&expected);
        for _ in 0..2 {
            let mut asset = generation
                .open_asset("assets/assets/image.svg")
                .unwrap()
                .unwrap();
            assert_eq!(asset.length(), expected.len() as u64);
            let mut bytes = Vec::new();
            asset.copy_to(&mut bytes).unwrap();
            assert_eq!(bytes, expected);
            assert_eq!(
                generation
                    .resource_digest("static/mokly-generated/assets/assets/image.svg")
                    .unwrap(),
                Some(hash.clone())
            );
            assert_eq!(cache.stats().entries, roots);
        }
    }
}

#[test]
fn same_size_asset_edits_fail_the_old_generation_and_change_linked_document_keys() {
    let directory = fixture(1);
    let (before, _) = support::prepare(directory.path(), 1024 * 1024, 1);
    let before = before.unwrap();
    let original = before.plans()["home/index.mobile.html"].key.clone();
    fs::write(
        directory.path().join("assets/image.svg"),
        vec![b'y'; 128 * 1024],
    )
    .unwrap();
    let error = before.resource("assets/assets/image.svg").unwrap_err();
    assert!(
        matches!(error, GraphError::InputsChanged { path } if path.ends_with(Path::new("assets/image.svg")))
    );
    let (after, _) = support::prepare(directory.path(), 1024 * 1024, 1);
    let after = after.unwrap();
    assert_ne!(original, after.plans()["home/index.mobile.html"].key);
    assert_eq!(
        after.resource("assets/assets/image.svg").unwrap().unwrap(),
        vec![b'y'; 128 * 1024]
    );
}

#[cfg(unix)]
#[test]
fn a_replaced_asset_parent_cannot_escape_through_an_equal_byte_symlink() {
    let directory = fixture(1);
    let outside = TempDir::new().unwrap();
    fs::write(outside.path().join("image.svg"), vec![b'x'; 128 * 1024]).unwrap();
    let (generation, _) = support::prepare(directory.path(), 1024 * 1024, 1);
    let generation = generation.unwrap();
    fs::rename(
        directory.path().join("assets"),
        directory.path().join("original-assets"),
    )
    .unwrap();
    std::os::unix::fs::symlink(outside.path(), directory.path().join("assets")).unwrap();
    assert!(matches!(
        generation.resource("assets/assets/image.svg"),
        Err(GraphError::InputsChanged { .. })
    ));
}

#[cfg(unix)]
#[test]
fn an_equal_byte_leaf_symlink_cannot_replace_the_captured_asset() {
    let directory = fixture(1);
    let outside = TempDir::new().unwrap();
    let target = outside.path().join("image.svg");
    fs::write(&target, vec![b'x'; 128 * 1024]).unwrap();
    let (generation, _) = support::prepare(directory.path(), 1024 * 1024, 1);
    let asset = directory.path().join("assets/image.svg");
    fs::remove_file(&asset).unwrap();
    std::os::unix::fs::symlink(target, asset).unwrap();
    assert!(matches!(
        generation.unwrap().resource("assets/assets/image.svg"),
        Err(GraphError::InputsChanged { .. })
    ));
}

#[test]
fn a_directory_cannot_replace_the_captured_asset() {
    let directory = fixture(1);
    let (generation, _) = support::prepare(directory.path(), 1024 * 1024, 1);
    let asset = directory.path().join("assets/image.svg");
    fs::remove_file(&asset).unwrap();
    fs::create_dir(asset).unwrap();
    assert!(matches!(
        generation.unwrap().resource("assets/assets/image.svg"),
        Err(GraphError::InputsChanged { .. })
    ));
}

#[cfg(unix)]
#[test]
fn a_fifo_replacement_fails_without_waiting_for_a_writer() {
    let directory = fixture(1);
    let (generation, _) = support::prepare(directory.path(), 1024 * 1024, 1);
    let generation = generation.unwrap();
    let asset = directory.path().join("assets/image.svg");
    fs::remove_file(&asset).unwrap();
    assert!(
        std::process::Command::new("mkfifo")
            .arg(asset)
            .status()
            .unwrap()
            .success()
    );
    let (send, receive) = std::sync::mpsc::sync_channel(1);
    let copy = std::thread::spawn(move || {
        send.send(generation.resource("assets/assets/image.svg"))
            .unwrap();
    });
    let result = receive
        .recv_timeout(std::time::Duration::from_secs(15))
        .expect("opaque asset open must not wait for a FIFO writer");
    assert!(matches!(result, Err(GraphError::InputsChanged { .. })));
    copy.join().unwrap();
}

#[cfg(unix)]
#[test]
fn a_socket_cannot_replace_the_captured_asset() {
    let directory = fixture(1);
    let (generation, _) = support::prepare(directory.path(), 1024 * 1024, 1);
    let asset = directory.path().join("assets/image.svg");
    fs::remove_file(&asset).unwrap();
    let _socket = UnixListener::bind(&asset).unwrap();
    assert!(matches!(
        generation.unwrap().resource("assets/assets/image.svg"),
        Err(GraphError::InputsChanged { path }) if path == asset
    ));
}
