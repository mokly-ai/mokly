//! Reload prerequisites independently of the requested render's deadline.

use crate::compiled::RestoreGeneration;
use crate::error::{Error, Result};
use crate::methods::{Call, Generation};
use crate::pool::Pool;
use crate::pool_state::Slot;
use crate::wire::{MethodResult, Request};

impl Pool {
    pub(super) fn prepare(
        &self,
        slot: &mut Slot,
        generation: &str,
        maps_needed: bool,
        description_needed: bool,
        bindings_needed: bool,
    ) -> Result<()> {
        let (bundle, maps, bindings, epoch, compiled) = {
            let state = self.lock()?;
            (
                state.bundles.get(generation).cloned(),
                state.maps.get(generation).cloned(),
                state.bindings.get(generation).cloned(),
                state.epochs.get(generation).copied().unwrap_or(0),
                state.compiled.get(generation).cloned(),
            )
        };
        if !slot.generations.contains_key(generation) {
            let Some(bundle) = bundle else {
                return Err(Error::UnknownGeneration {
                    generation: generation.to_owned(),
                });
            };
            let response = if let Some(compiled) = compiled {
                self.prerequisite(
                    slot,
                    Call::RestoreGeneration(Box::new(RestoreGeneration {
                        generation: generation.into(),
                        params: bundle,
                        compiled: (*compiled).clone(),
                    })),
                )?;
                slot.generations.insert(generation.into(), epoch);
                None
            } else {
                Some(self.prerequisite(slot, Call::Bundle(bundle))?)
            };
            if let Some(response) = response {
                if let MethodResult::Bundle(value) = response {
                    if value.generation != generation {
                        self.prerequisite(
                            slot,
                            Call::Dispose(Generation {
                                generation: value.generation,
                            }),
                        )?;
                        return Err(Error::GenerationChanged {
                            generation: generation.to_owned(),
                        });
                    }
                    slot.generations.insert(generation.to_owned(), epoch);
                } else {
                    return Err(Error::GenerationChanged {
                        generation: generation.to_owned(),
                    });
                }
            }
        }
        if maps_needed
            && !slot.maps.contains(generation)
            && let Some(maps) = maps
        {
            self.prerequisite(slot, Call::CssModules(maps))?;
            slot.maps.insert(generation.to_owned());
        }
        if description_needed && !slot.described.contains(generation) {
            self.prerequisite(
                slot,
                Call::Describe(Generation {
                    generation: generation.to_owned(),
                }),
            )?;
            slot.described.insert(generation.to_owned());
        }
        if description_needed
            && bindings_needed
            && let Some(bindings) = bindings
            && slot.bindings.get(generation) != Some(&bindings)
        {
            self.prerequisite(slot, Call::Bindings(bindings.clone()))?;
            slot.bindings.insert(generation.to_owned(), bindings);
        }
        Ok(())
    }

    fn prerequisite(&self, slot: &mut Slot, call: Call) -> Result<MethodResult> {
        if self.lock()?.stopped {
            return Err(Error::Cancelled);
        }
        let deadline = self.options.timeout_ms.unwrap_or_else(|| call.timeout_ms());
        slot.worker.request(&Request { id: 1, call }, deadline)
    }
}
