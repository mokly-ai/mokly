//! Isolated real Git fixtures and host boundary composition.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_git::command::Runner;
use mokly_git::control::{Cancellation, SystemClock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::identity::ObjectId;
use mokly_git::repository::{GitRepositories, Repositories, Repository};
use mokly_git::system::SystemRunner;
use mokly_platform::processes::SystemProcessGroups;
use mokly_test_support::git::git;
use tempfile::TempDir;

pub struct Fixture(pub TempDir);

impl Fixture {
    pub fn new() -> Self {
        let fixture = Self(tempfile::tempdir().unwrap());
        git(fixture.root(), &["init", "-b", "main"]);
        git(fixture.root(), &["config", "user.name", "Mokly Tests"]);
        git(
            fixture.root(),
            &["config", "user.email", "tests@mokly.invalid"],
        );
        fixture
    }

    pub fn root(&self) -> &Path {
        self.0.path()
    }

    pub fn write(&self, path: &str, bytes: &[u8]) {
        let path = self.root().join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    pub fn commit(&self) -> ObjectId {
        git(self.root(), &["add", "-A"]);
        git(self.root(), &["commit", "--allow-empty", "-m", "fixture"]);
        ObjectId::parse(String::from_utf8_lossy(&git(self.root(), &["rev-parse", "HEAD"])).trim())
            .unwrap()
    }

    pub fn repository(&self) -> Arc<dyn Repository> {
        let factory: &dyn Repositories = &GitRepositories {
            runner: runner(Arc::new(Token::default())),
            disk: Arc::new(SystemDisk),
        };
        factory.open(self.root()).unwrap()
    }
}

pub fn runner(cancellation: Arc<dyn Cancellation>) -> Arc<dyn Runner> {
    Arc::new(SystemRunner {
        groups: Arc::new(SystemProcessGroups),
        clock: Arc::new(SystemClock::default()),
        cancellation,
    })
}
