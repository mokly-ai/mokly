//! Generation recipes reloaded on demand after a process retry or recycle.

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
                .filter(|id| !state.bundles.contains_key(*id))
                .cloned()
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
        }
        if let Some(generation) = generation(call) {
            self.prepare(
                slot,
                generation,
                !matches!(call, Call::CssModules(_)),
                matches!(
                    call,
                    Call::RenderScreen(_)
                        | Call::RenderComponent(_)
                        | Call::RenderStory(_)
                        | Call::RenderPage(_)
                ),
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
                    state
                        .bundles
                        .insert(result.generation.clone(), bundle.clone());
                    slot.generations.insert(result.generation.clone());
                }
                (Call::CssModules(maps), _) => {
                    state.maps.insert(maps.generation.clone(), maps.clone());
                    slot.maps.insert(maps.generation.clone());
                }
                (Call::Dispose(generation), _) => {
                    state.bundles.remove(&generation.generation);
                    state.maps.remove(&generation.generation);
                    slot.generations.remove(&generation.generation);
                    slot.maps.remove(&generation.generation);
                    slot.described.remove(&generation.generation);
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
        Call::Describe(value) => Some(&value.generation),
        Call::RenderScreen(value) => Some(&value.generation),
        Call::RenderComponent(value) => Some(&value.render.generation),
        Call::RenderStory(value) => Some(&value.generation),
        Call::RenderPage(value) => Some(&value.generation),
        Call::CssModules(value) => Some(&value.generation),
        _ => None,
    }
}
