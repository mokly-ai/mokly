//! Cancellation after a disk write removes an incomplete converted extraction.

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_git::control::Token;
use mokly_git::disk::{Archive, Disk, SystemDisk};
use mokly_git::error::{Error, Result};
use mokly_git::fingerprint::Fingerprint;
use mokly_git::identity::RepoPath;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::tree::Limits;

#[expect(
    dead_code,
    reason = "the cancellation case composes its own repository"
)]
mod support;

struct CancelDisk {
    token: Arc<Token>,
    writes: Arc<AtomicUsize>,
}

impl Disk for CancelDisk {
    fn canonicalize(&self, path: &Path) -> Result<PathBuf> {
        SystemDisk.canonicalize(path)
    }
    fn read(&self, root: &Path, path: &RepoPath, limit: usize) -> Result<Option<Vec<u8>>> {
        SystemDisk.read(root, path, limit)
    }
    fn fingerprint(&self, root: &Path, path: &RepoPath) -> Result<Option<Fingerprint>> {
        SystemDisk.fingerprint(root, path)
    }
    fn read_pinned(
        &self,
        root: &Path,
        path: &RepoPath,
        limit: usize,
        expected: &Fingerprint,
    ) -> Result<Option<Vec<u8>>> {
        SystemDisk.read_pinned(root, path, limit, expected)
    }
    fn digest_pinned(
        &self,
        root: &Path,
        path: &RepoPath,
        expected: &Fingerprint,
    ) -> Result<Option<String>> {
        SystemDisk.digest_pinned(root, path, expected)
    }
    fn archive(&self, destination: &Path) -> Result<Box<dyn Archive>> {
        Ok(Box::new(CancelArchive {
            archive: SystemDisk.archive(destination)?,
            destination: destination.into(),
            token: self.token.clone(),
            writes: self.writes.clone(),
        }))
    }
}

struct CancelArchive {
    archive: Box<dyn Archive>,
    destination: PathBuf,
    token: Arc<Token>,
    writes: Arc<AtomicUsize>,
}

impl Archive for CancelArchive {
    fn file(&mut self, path: &RepoPath, executable: bool) -> Result<Option<Box<dyn Write + Send>>> {
        Ok(self.archive.file(path, executable)?.map(|writer| {
            Box::new(CancelWriter {
                writer,
                path: self.destination.join(path.as_str()),
                token: self.token.clone(),
                writes: self.writes.clone(),
            }) as Box<dyn Write + Send>
        }))
    }
    fn finish(&mut self) -> Result<()> {
        self.archive.finish()
    }
}

struct CancelWriter {
    writer: Box<dyn Write + Send>,
    path: PathBuf,
    token: Arc<Token>,
    writes: Arc<AtomicUsize>,
}

impl Write for CancelWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        let count = self.writer.write(bytes)?;
        self.writer.flush()?;
        if self.writes.fetch_add(1, Ordering::SeqCst) == 0 {
            assert_eq!(fs::read(&self.path).unwrap(), &bytes[..count]);
            self.token.cancel();
        }
        Ok(count)
    }
    fn flush(&mut self) -> io::Result<()> {
        self.writer.flush()
    }
}

#[test]
fn cancellation_after_a_written_prefix_removes_the_partial_destination() {
    let fixture = support::Fixture::new();
    fixture.write("large.bin", &vec![37; 1024 * 1024]);
    let base = fixture.commit();
    let target = fixture.root().join("partial");
    let token = Arc::new(Token::default());
    let writes = Arc::new(AtomicUsize::new(0));
    let repositories: &dyn Repositories = &GitRepositories {
        runner: support::runner(token.clone()),
        disk: Arc::new(CancelDisk {
            token,
            writes: writes.clone(),
        }),
    };
    let repository = repositories.open(fixture.root()).unwrap();
    assert!(matches!(
        repository.extract(&base, &target, Limits::default()),
        Err(Error::Cancelled)
    ));
    assert_eq!(writes.load(Ordering::SeqCst), 1);
    assert!(!target.exists());
}
