//! Lazy slot suppliers release their context graph without recursive Arc destruction.

use std::mem;
use std::sync::Arc;

use crate::context::Context;

impl Drop for Context {
    fn drop(&mut self) {
        let mut pending: Vec<_> = mem::take(&mut self.slots)
            .into_values()
            .map(|slot| slot.supplier)
            .collect();
        while let Some(supplier) = pending.pop() {
            if let Some(mut context) = Arc::into_inner(supplier) {
                pending.extend(
                    mem::take(&mut context.slots)
                        .into_values()
                        .map(|slot| slot.supplier),
                );
            }
        }
    }
}
