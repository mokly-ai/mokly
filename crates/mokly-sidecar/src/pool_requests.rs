//! Generation recipes reloaded on demand after a process retry or recycle.

use std::sync::Arc;

use crate::bundle_outcomes::CacheOutcome;
use crate::error::{Error, Result};
use crate::methods::Call;
use crate::pool::Pool;
use crate::pool_bundle_cache::BundleAttempt;
use crate::pool_cleanup;
use crate::pool_exchange::reusable;
use crate::pool_preparation::Prerequisites;
use crate::pool_state::Slot;
use crate::postcss_preparation::PrepareContext;
use crate::wire::{MethodResult, Request};

impl Pool {
    pub(super) fn execute(
        &self,
        slot: &mut Slot,
        call: &Call,
        deadline: u64,
        attempt: &mut BundleAttempt,
    ) -> Result<MethodResult> {
        if matches!(call, Call::Bundle(_)) {
            attempt.pin_loaded(&self.lock(), slot);
        }
        self.cleanup(slot)?;
        if let Some(context) = call.postcss_context() {
            self.lock().contexts.insert(context.into());
            slot.contexts.insert(context.into());
        }
        if let Call::Bundle(request) = call {
            if let Some(preparation) = PrepareContext::for_bundle(request) {
                self.prepare_context(slot, preparation)?;
            }
            self.seed_bundle(slot, request, attempt)?;
        }
        if let Some(generation) = generation(call) {
            let prerequisites = Prerequisites::for_call(call);
            self.prepare(
                slot,
                generation,
                prerequisites.maps,
                prerequisites.description,
                prerequisites.bindings,
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
        if self.lock().stopped {
            return Err(Error::Cancelled);
        }
        let mut result = slot.worker.request(
            &Request {
                id: 1,
                quiet: false,
                call: call.clone(),
            },
            deadline,
        )?;
        {
            let mut state = self.lock();
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
                    let compiled = &result.compiled;
                    let restored = state.recipes.take_reused(&bundle.params, compiled);
                    let shared = state
                        .compiled
                        .values()
                        .find(|value| value.same_recipe(compiled))
                        .cloned()
                        .or(restored)
                        .unwrap_or_else(|| compiled.clone());
                    state.compiled.insert(result.generation.clone(), shared);
                    state
                        .bundles
                        .insert(result.generation.clone(), bundle.params.clone());
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
                    let shared = state
                        .bindings
                        .get(&bindings.generation)
                        .filter(|retained| retained.as_ref() == bindings)
                        .cloned()
                        .unwrap_or_else(|| Arc::new(bindings.clone()));
                    state
                        .bindings
                        .insert(bindings.generation.clone(), shared.clone());
                    slot.bindings.insert(bindings.generation.clone(), shared);
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
        if let (Call::Bundle(params), MethodResult::Bundle(bundle)) = (call, &mut result) {
            self.complete_bundle(params, bundle, attempt);
            if slot.source_root == self.launch.repository
                && !matches!(bundle.cache, Some(CacheOutcome::Memory | CacheOutcome::Hit))
            {
                slot.last_compilation = Some(bundle.epoch);
            }
        }
        Ok(result)
    }
    pub(super) fn cleanup(&self, slot: &mut Slot) -> Result<()> {
        pool_cleanup::cleanup(&self.state, slot, self.options.timeout_ms)?;
        Ok(())
    }

    /// Start a bundle request's preparation in its own process before the bundle cache read.
    ///
    /// The `bundle` request still carries the preparation, so after an error reply that leaves
    /// the process usable the sidecar starts it there. A crash or a timeout keeps the retry.
    fn prepare_context(&self, slot: &mut Slot, preparation: PrepareContext) -> Result<()> {
        match self.prerequisite(slot, Call::PrepareContext(preparation), false) {
            Err(error) if reusable(&error) => {
                tracing::warn!(%error, "sidecar context preparation failed before its bundle");
                Ok(())
            }
            outcome => outcome,
        }
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
