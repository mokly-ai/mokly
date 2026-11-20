//! A real storage adapter pauses one partial payload until the test releases it.

use std::fs;
use std::io::Write;
use std::path::Path;
use std::sync::{Arc, Barrier, Mutex, mpsc};

use mokly_compare::bundle_cache_types::{BundleReceipt, BundleRecord, CompilationRead, OpenBundle};
use mokly_compare::cache_types::{Receipt, Record, Storage};
use mokly_compare::error::Result;
use mokly_sidecar::bundle_store::RecordToken;

/// Delegates all cache IO except the first data write.
pub struct PausedStorage {
    /// Real confined storage.
    pub inner: Arc<dyn Storage>,
    /// First-half readiness, consumed by one writer.
    pub ready: Mutex<Option<mpsc::Sender<()>>>,
    /// Keeps the partial stage alive until both fast calls finish.
    pub resume: Arc<Barrier>,
}

macro_rules! delegate {
    ($name:ident($($arg:ident:$kind:ty),*) -> $result:ty) => {
        fn $name(&self,$($arg:$kind),*) -> $result { self.inner.$name($($arg),*) }
    };
}

impl Storage for PausedStorage {
    fn render_sequence(&self, namespace: &Path, floor: u64) -> Result<Option<u64>> {
        self.inner.render_sequence(namespace, floor)
    }
    fn write(&self, path: &Path, bytes: &[u8]) -> Result<()> {
        let ready = self.ready.lock().unwrap().take();
        if let Some(ready) = ready {
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(path)
                .unwrap();
            let half = bytes.len() / 2;
            file.write_all(&bytes[..half]).unwrap();
            ready.send(()).unwrap();
            self.resume.wait();
            file.write_all(&bytes[half..]).unwrap();
            Ok(())
        } else {
            self.inner.write(path, bytes)
        }
    }
    delegate!(bundle_compilation(entry:&Path) -> Result<CompilationRead>);
    delegate!(bundle_open(entry:&Path) -> Result<OpenBundle>);
    delegate!(bundle_records(directory:&Path,limit:u64) -> Result<Vec<BundleRecord>>);
    delegate!(bundle_receipt(entry:&Path,receipt:&BundleReceipt,durable:bool) -> Result<()>);
    delegate!(bundle_nonce() -> Result<RecordToken>);
    delegate!(bundle_retire(path:&Path,trash:&Path) -> Result<()>);
    delegate!(directory(path:&Path) -> Result<bool>);
    delegate!(prepare(directory:&Path) -> Result<()>);
    delegate!(stages(directory:&Path) -> Result<Vec<String>>);
    delegate!(inspect(entry:&Path,limit:u64) -> Result<Option<Receipt>>);
    delegate!(synchronize(directory:&Path) -> Result<()>);
    delegate!(records(entries:&Path) -> Result<Vec<Record>>);
    delegate!(receipt(entry:&Path,receipt:&Receipt) -> Result<()>);
    delegate!(touch(entry:&Path,receipt:&Receipt) -> Result<()>);
    delegate!(retire(path:&Path,trash:&Path) -> Result<()>);
    delegate!(size(path:&Path,limit:u64) -> Result<u64>);
    delegate!(remove(path:&Path) -> Result<()>);
    delegate!(publish(stage:&Path,target:&Path) -> Result<()>);
    delegate!(copy(source:&Path,destination:&Path,limit:u64) -> Result<()>);
}
