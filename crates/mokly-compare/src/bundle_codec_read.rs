//! Reject foreign headers before payload reads, then hash and decode bounded data.

use std::io::{BufReader, Read, SeekFrom};

use mokly_sidecar::bundle_outcomes::EntryFault;
use mokly_sidecar::durable_recipe::DurableRecipe;
use mokly_sidecar::methods::Bundle;
use mokly_sidecar::reusable_recipe::ReusableRecipe;
use sha2::{Digest, Sha256};

use crate::bundle_cache_types::BundleInput;
use crate::bundle_codec::{Codec, HEADER_BYTES, Header, Payload, StoredKind, hex, same_settings};

impl Codec {
    pub(crate) fn decode(
        &self,
        input: &mut dyn BundleInput,
        bytes: u64,
        params: &Bundle,
        version: &str,
    ) -> Result<DurableRecipe, EntryFault> {
        if bytes > self.file_bytes as u64 {
            return Err(EntryFault::Damaged);
        }
        let mut first = Vec::new();
        loop {
            let mut byte = [0];
            match input.read(&mut byte) {
                Ok(0) => return Err(EntryFault::Damaged),
                Ok(_) if byte[0] == b'\n' => break,
                Ok(_) => first.push(byte[0]),
                Err(_) => return Err(EntryFault::Unreadable),
            }
            if first.len() > HEADER_BYTES {
                return Err(EntryFault::Damaged);
            }
        }
        let header = match serde_json::from_slice::<Header>(&first) {
            Ok(header) => header,
            Err(_) => return Err(EntryFault::Damaged),
        };
        if header.format_version != 1 || header.mokly_version != version {
            return Err(EntryFault::VersionMismatch);
        }
        if header.payload_digest.len() != 64
            || !header
                .payload_digest
                .bytes()
                .all(|byte| byte.is_ascii_hexdigit())
        {
            return Err(EntryFault::Damaged);
        }
        let start = first.len() as u64 + 1;
        let Some(payload_bytes) = bytes.checked_sub(start) else {
            return Err(EntryFault::Damaged);
        };
        let mut hash = Sha256::new();
        let mut read = 0u64;
        let mut chunk = [0; 64 * 1024];
        loop {
            let count = match input.read(&mut chunk) {
                Ok(count) => count,
                Err(_) => return Err(EntryFault::Unreadable),
            };
            if count == 0 {
                break;
            }
            read = read.saturating_add(count as u64);
            if read > payload_bytes {
                return Err(EntryFault::Damaged);
            }
            hash.update(&chunk[..count]);
        }
        if read != payload_bytes
            || !hex(&hash.finalize()).eq_ignore_ascii_case(&header.payload_digest)
        {
            return Err(EntryFault::Damaged);
        }
        if input.seek(SeekFrom::Start(start)).is_err() {
            return Err(EntryFault::Unreadable);
        }
        let stored = match serde_json::from_reader::<_, Payload>(BufReader::new(
            input.take(payload_bytes),
        )) {
            Ok(stored) => stored,
            Err(source) if source.is_io() => return Err(EntryFault::Unreadable),
            Err(_) => return Err(EntryFault::Damaged),
        };
        if stored.kind != StoredKind::Bundles || !same_settings(&stored.recipe.params, params) {
            return Err(EntryFault::WrongSettings);
        }
        ReusableRecipe::new(
            stored.recipe.generation,
            stored.recipe.params,
            stored.recipe.modules,
            stored.recipe.compiled,
        )
        .and_then(DurableRecipe::new)
        .ok_or(EntryFault::Damaged)
    }
}
