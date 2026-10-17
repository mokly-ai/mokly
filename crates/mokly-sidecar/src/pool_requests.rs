//! Generation recipes reloaded on demand after a process retry or recycle.

use std::sync::Arc;

use crate::error::{Error, Result};
use crate::methods::Call;
use crate::pool::Pool;
use crate::pool_cleanup;
use crate::pool_state::Slot;
use crate::wire::{MethodResult, Request};

impl Pool {
    pub(super) fn execute(
        &self,
        slot: &mut Slot,
        call: &Call,
        deadline: u64,
    ) -> Result<MethodResult> {
        self.cleanup(slot)?;
        if let Call::Bundle(params) = call {
            self.seed_compilation(slot, params)?;
        }
        if let Some(generation) = generation(call) {
            self.prepare(
                slot,
                generation,
                !matches!(call, Call::CssModules(_)),
                matches!(
                    call,
                    Call::Bindings(_)
                        | Call::RenderScreen(_)
                        | Call::RenderComponent(_)
                        | Call::RenderStory(_)
                        | Call::RenderPage(_)
                ),
                !matches!(call, Call::Bindings(_)),
            )?;
        }
        if matches!(
            call,
            Call::RenderScreen(_)
                | Call::RenderComponent(_)
                | Call::RenderStory(_)
                | Call::RenderPage(_)
        ) {
            slot.renders += 1;
        }
        if self.lock()?.stopped {
            return Err(Error::Cancelled);
        }
        if let Call::ProcessCss(params) = call {
            self.lock()?.contexts.insert(params.context.clone());
            slot.contexts.insert(params.context.clone());
        }
        let mut result = slot.worker.request(
            &Request {
                id: 1,
                call: call.clone(),
            },
            deadline,
        )?;
        {
            let mut state = self.lock()?;
            if state.stopped {
                return Err(Error::Cancelled);
            }
            match (call, &mut result) {
                (Call::Bundle(bundle), MethodResult::Bundle(result)) => {
                    state.next_epoch += 1;
                    let epoch = state.next_epoch;
                    result.epoch = epoch;
                    state.epochs.insert(result.generation.clone(), epoch);
                    state
                        .modules
                        .insert(result.generation.clone(), result.modules.clone());
                    state
                        .leases
                        .entry(result.generation.clone())
                        .or_default()
                        .insert(epoch);
                    if let Some(compiled) = &result.compiled {
                        let shared = state
                            .compiled
                            .values()
                            .find(|value| {
                                value.identity == compiled.identity
                                    && value.inputs == compiled.inputs
                                    && value.input_directories == compiled.input_directories
                                    && value.unmapped_dependency_directories
                                        == compiled.unmapped_dependency_directories
                            })
                            .cloned()
                            .unwrap_or_else(|| Arc::new(compiled.clone()));
                        state.compiled.insert(result.generation.clone(), shared);
                    }
                    state
                        .bundles
                        .insert(result.generation.clone(), bundle.clone());
                    slot.generations.insert(result.generation.clone(), epoch);
                    slot.maps.remove(&result.generation);
                    slot.described.remove(&result.generation);
                    slot.bindings.remove(&result.generation);
                }
                (Call::CssModules(maps), _) => {
                    state.maps.insert(maps.generation.clone(), maps.clone());
                    slot.maps.insert(maps.generation.clone());
                }
                (Call::Bindings(bindings), _) => {
                    state
                        .bindings
                        .insert(bindings.generation.clone(), bindings.clone());
                    slot.bindings
                        .insert(bindings.generation.clone(), bindings.clone());
                }
                (Call::ProcessCss(params), _) => {
                    state.contexts.insert(params.context.clone());
                    slot.contexts.insert(params.context.clone());
                }
                (Call::DisposeContext(params), _) => {
                    state.contexts.remove(&params.context);
                    slot.contexts.remove(&params.context);
                }
                (Call::Dispose(generation), _) => {
                    state.bundles.remove(&generation.generation);
                    state.compiled.remove(&generation.generation);
                    state.modules.remove(&generation.generation);
                    state.leases.remove(&generation.generation);
                    state.epochs.remove(&generation.generation);
                    state.maps.remove(&generation.generation);
                    state.bindings.remove(&generation.generation);
                    slot.generations.remove(&generation.generation);
                    slot.maps.remove(&generation.generation);
                    slot.described.remove(&generation.generation);
                    slot.bindings.remove(&generation.generation);
                }
                (Call::Describe(generation), _) => {
                    slot.described.insert(generation.generation.clone());
                }
                _ => {}
            }
        }
        Ok(result)
    }
    pub(super) fn cleanup(&self, slot: &mut Slot) -> Result<()> {
        pool_cleanup::cleanup(&self.state, slot, self.options.timeout_ms)?;
        Ok(())
    }
}

pub(super) fn generation(call: &Call) -> Option<&str> {
    match call {
        Call::Bindings(value) => Some(&value.generation),
        Call::Describe(value) => Some(&value.generation),
        Call::RenderScreen(value) => Some(&value.generation),
        Call::RenderComponent(value) => Some(&value.render.generation),
        Call::RenderStory(value) => Some(&value.generation),
        Call::RenderPage(value) => Some(&value.generation),
        Call::CssModules(value) => Some(&value.generation),
        _ => None,
    }
}
