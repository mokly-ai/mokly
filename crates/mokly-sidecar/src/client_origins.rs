//! Process-local origins share recipe storage already owned by the core pool.

use std::collections::BTreeMap;
use std::sync::{Arc, Weak};

use serde::de;

use crate::bundle_reply::BundleReply;
use crate::compiled::CompiledGeneration;
use crate::error::{Error, ProtocolError, Result};
use crate::methods::Call;
use crate::results::{Bundle, Module};
use crate::wire::MethodResult;

enum Origin {
    Compiled,
    Restored {
        compiled: Weak<CompiledGeneration>,
        modules: Weak<Vec<Module>>,
    },
}

#[derive(Default)]
pub(super) struct Origins {
    loaded: BTreeMap<String, Origin>,
}

impl Origins {
    pub(super) fn resolve(&self, reply: BundleReply) -> Result<Box<Bundle>> {
        let reply = match reply {
            BundleReply::Full(bundle) => return Ok(bundle),
            BundleReply::Restored(reply) => reply,
        };
        let Some((compiled, modules)) =
            self.loaded
                .get(&reply.restored_generation)
                .and_then(|origin| {
                    let Origin::Restored { compiled, modules } = origin else {
                        return None;
                    };
                    compiled.upgrade().zip(modules.upgrade())
                })
        else {
            return Err(Error::Protocol(ProtocolError::Json {
                source: de::Error::custom(format!(
                    "unknown restored generation {}",
                    reply.restored_generation
                )),
            }));
        };
        Ok(Box::new(Bundle {
            generation: reply.generation,
            unmapped_dependency_directories: Some(
                compiled
                    .unmapped_dependency_directories
                    .clone()
                    .unwrap_or_default(),
            ),
            compiled,
            modules,
            plan: None,
            epoch: 0,
            cache: None,
            compile_count: 0,
        }))
    }

    pub(super) fn record(&mut self, call: &Call, result: &MethodResult) {
        match (call, result) {
            (Call::Bundle(_), MethodResult::Bundle(bundle)) => {
                self.loaded
                    .insert(bundle.generation.clone(), Origin::Compiled);
            }
            (Call::RestoreGeneration(restore), _) => {
                self.loaded
                    .entry(restore.generation.clone())
                    .or_insert_with(|| Origin::Restored {
                        compiled: Arc::downgrade(&restore.compiled),
                        modules: Arc::downgrade(&restore.modules),
                    });
            }
            (Call::Dispose(generation), _) => {
                self.loaded.remove(&generation.generation);
            }
            (Call::Shutdown(_), _) => self.loaded.clear(),
            _ => {}
        }
    }
}
