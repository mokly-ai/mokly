//! Isolated repositories for the merged runner's real process and file adapters.

use std::fs;
#[cfg(unix)]
use std::os::unix::fs::symlink;
#[cfg(unix)]
use std::os::unix::process::ExitStatusExt;
#[cfg(windows)]
use std::os::windows::process::ExitStatusExt;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Output};

use tempfile::TempDir;

pub(super) trait Fixture {
    fn root(&self) -> &Path;
    fn write(&self, path: &str, text: &str);
    fn copy(&self, path: &str);
    fn copy_tree(&self, path: &str);
    fn link(&self, path: &str, source: &Path);
    fn tools(&self);
    fn run(&self, program: &str, args: &[&str]) -> Output;
    fn xtask(&self, args: &[&str]) -> Output;
    fn baseline(&self);
}

pub(super) trait FixtureFactory {
    fn create(&self) -> Box<dyn Fixture>;
}

pub(super) struct TemporaryFixtures;

struct GitFixture {
    directory: TempDir,
}

impl FixtureFactory for TemporaryFixtures {
    fn create(&self) -> Box<dyn Fixture> {
        let fixture: Box<dyn Fixture> = Box::new(GitFixture {
            directory: TempDir::new().unwrap(),
        });
        success(fixture.run("git", &["init", "--initial-branch=main"]));
        success(fixture.run("git", &["config", "user.name", "Fixture"]));
        success(fixture.run("git", &["config", "user.email", "fixture@example.invalid"]));
        fixture.write("README.md", "# Fixture\n");
        fixture.write(".gitignore", "target/\nnode_modules/\n");
        fixture.write("xtask/README.md", "# Fixture runner\n");
        fixture.baseline();
        fixture
    }
}

impl Fixture for GitFixture {
    fn root(&self) -> &Path {
        self.directory.path()
    }

    fn write(&self, path: &str, text: &str) {
        let path = self.root().join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }

    fn copy(&self, path: &str) {
        let text = fs::read_to_string(repository().join(path)).unwrap();
        self.write(path, &text);
    }

    fn copy_tree(&self, path: &str) {
        for entry in fs::read_dir(repository().join(path)).unwrap() {
            let entry = entry.unwrap();
            let relative = format!("{path}/{}", entry.file_name().to_str().unwrap());
            if entry.file_type().unwrap().is_dir() {
                self.copy_tree(&relative);
            } else {
                self.copy(&relative);
            }
        }
    }

    fn link(&self, path: &str, source: &Path) {
        let destination = self.root().join(path);
        fs::create_dir_all(destination.parent().unwrap()).unwrap();
        link_directory(source, &destination);
    }

    fn tools(&self) {
        self.link("node_modules", &repository().join("node_modules"));
    }

    fn run(&self, program: &str, args: &[&str]) -> Output {
        let program = if cfg!(windows) && matches!(program, "npm" | "npx") {
            format!("{program}.cmd")
        } else {
            program.to_owned()
        };
        Command::new(program)
            .args(args)
            .current_dir(self.root())
            .env("CARGO_TARGET_DIR", self.root().join("target"))
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("GIT_CONFIG_COUNT", "1")
            .env("GIT_CONFIG_KEY_0", "commit.gpgsign")
            .env("GIT_CONFIG_VALUE_0", "false")
            .output()
            .unwrap()
    }

    fn xtask(&self, args: &[&str]) -> Output {
        if args.contains(&"--help") {
            return self.run(env!("CARGO_BIN_EXE_xtask"), args);
        }
        let result = xtask::cli::run_at(self.root().to_owned(), args);
        let (status, stderr) = match result {
            Ok(()) => (ExitStatus::from_raw(0), Vec::new()),
            Err(error) => (ExitStatus::from_raw(256), error.to_string().into_bytes()),
        };
        Output {
            status,
            stdout: Vec::new(),
            stderr,
        }
    }

    fn baseline(&self) {
        success(self.run("git", &["add", "-A"]));
        success(self.run(
            "git",
            &["commit", "--allow-empty", "-m", "fixture baseline"],
        ));
        success(self.run("git", &["update-ref", "refs/remotes/origin/main", "HEAD"]));
    }
}

pub(super) fn repository() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_owned()
}

pub(super) fn success(output: Output) -> String {
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.status.success(), "{text}");
    text
}

pub(super) fn failure(output: Output, diagnostic: &str) {
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(!output.status.success(), "expected rejection: {text}");
    assert!(text.contains(diagnostic), "missing {diagnostic:?}: {text}");
}

#[cfg(unix)]
fn link_directory(source: &Path, destination: &Path) {
    symlink(source, destination).unwrap();
}

#[cfg(windows)]
fn link_directory(source: &Path, destination: &Path) {
    success(
        Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(destination)
            .arg(source)
            .output()
            .unwrap(),
    );
}
