use std::path::{Path, PathBuf};
use std::thread;

use crate::process::{Invocation, Mokly};
use crate::publication::temporary_root;

fn variable(invocation: &Invocation, name: &str) -> Option<PathBuf> {
    invocation
        .command
        .get_envs()
        .find(|(key, _)| *key == name)
        .and_then(|(_, value)| value)
        .map(PathBuf::from)
}

fn invocation() -> Invocation {
    Mokly::new("mokly").command(Path::new("."), &[], "plain")
}

#[test]
fn the_invocations_of_one_test_share_one_cache_folder_outside_the_user_cache() {
    let first = invocation();
    let second = invocation();
    let cache = variable(&first, "XDG_CACHE_HOME").expect("the cache is isolated");
    for name in ["XDG_CACHE_HOME", "HOME", "LOCALAPPDATA"] {
        assert_eq!(variable(&first, name).as_ref(), Some(&cache), "{name}");
        assert_eq!(variable(&second, name).as_ref(), Some(&cache), "{name}");
    }
    assert!(cache.starts_with(temporary_root()));
    assert!(cache.is_dir());
    let other = thread::spawn(|| variable(&invocation(), "XDG_CACHE_HOME").unwrap())
        .join()
        .unwrap();
    assert_ne!(other, cache);
    assert!(
        !other.exists(),
        "the folder of an ended test thread is removed"
    );
}
