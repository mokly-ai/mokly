//! A partial source lease must not block another preparation of the same commit.

use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use mokly_compare::cache_types::{Builder, Cache, Kind};
use mokly_compare::error::Result;
use mokly_git::control::{Clock, Token};

#[expect(dead_code, reason = "this case uses the cache factory only")]
mod support;

struct Partial;

impl Builder for Partial {
    fn reusable(&self) -> bool {
        false
    }
    fn build(&self, destination: &Path) -> Result<()> {
        fs::create_dir(destination).unwrap();
        fs::write(destination.join("good.txt"), b"independent").unwrap();
        Ok(())
    }
}

struct CancelWait(Arc<Token>);

impl Clock for CancelWait {
    fn now(&self) -> Duration {
        Duration::ZERO
    }
    fn pause(&self, _: Duration) {
        self.0.cancel();
    }
}

#[test]
fn a_partial_lease_does_not_lock_the_next_preparation() {
    let temporary = tempfile::tempdir().unwrap();
    let mut cache = support::cache(temporary.path().join("cache"), 10000);
    let token = Arc::new(Token::default());
    cache.cancellation = token.clone();
    cache.clock = Arc::new(CancelWait(token));
    let key = "c".repeat(64);
    let first = cache.get(Kind::Sources, &key, &Partial).unwrap();
    let second = cache.get(Kind::Sources, &key, &Partial).unwrap();
    assert_ne!(first.directory, second.directory);
    assert_eq!(
        fs::read(first.directory.join("good.txt")).unwrap(),
        b"independent"
    );
    assert_eq!(
        fs::read(second.directory.join("good.txt")).unwrap(),
        b"independent"
    );
}
