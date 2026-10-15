//! Generation recipes reloaded on demand after a process retry or recycle.

use crate::bindings::DisposeContext;
use crate::error::{Error, Result};
use crate::methods::{Call, Generation};
use crate::pool::Pool;
use crate::pool_state::Slot;
use crate::wire::{MethodResult, Request};

impl Pool {
    pub(super) fn execute(
        &self,
        slot: &mut Slot,
        call: &Call,
        deadline: u64,
    ) -> Result<MethodResult> {
        let stale = {
            let state = self.lock()?;
            slot.generations
                .iter()
                .filter(|(id, epoch)| {
                    !state.bundles.contains_key(*id)
                        || state.epochs.get(*id).copied().unwrap_or(0) != **epoch
                })
                .map(|(id, _)| id.clone())
                .collect::<Vec<_>>()
        };
        for generation in stale {
            slot.worker.request(
                &Request {
                    id: 1,
                    call: Call::Dispose(Generation {
                        generation: generation.clone(),
                    }),
                },
                self.options.timeout_ms.unwrap_or(30_000),
            )?;
            slot.generations.remove(&generation);
            slot.maps.remove(&generation);
            slot.described.remove(&generation);
            slot.bindings.remove(&generation);
        }
        let stale_contexts = {
            let state = self.lock()?;
            slot.contexts
                .difference(&state.contexts)
                .cloned()
                .collect::<Vec<_>>()
        };
        for context in stale_contexts {
            slot.worker.request(
                &Request {
                    id: 1,
                    call: Call::DisposeContext(DisposeContext {
                        context: context.clone(),
                    }),
                },
                self.options.timeout_ms.unwrap_or(30_000),
            )?;
            slot.contexts.remove(&context);
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
        let result = slot.worker.request(
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
            match (call, &result) {
                (Call::Bundle(bundle), MethodResult::Bundle(result)) => {
                    let epoch = match state.epochs.get(&result.generation) {
                        Some(epoch) => *epoch,
                        None => {
                            state.next_epoch += 1;
                            let epoch = state.next_epoch;
                            state.epochs.insert(result.generation.clone(), epoch);
                            epoch
                        }
                    };
                    state
                        .bundles
                        .insert(result.generation.clone(), bundle.clone());
                    slot.generations.insert(result.generation.clone(), epoch);
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
}

fn generation(call: &Call) -> Option<&str> {
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
