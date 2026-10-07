//! Parallel warmup and the all-probes-before-suites barrier.

use std::collections::BTreeSet;
use std::thread;

use crate::remote::cleanup::BoxCleanup;
use crate::remote::clients::success;
use crate::remote::error::{Error, Operation, Result};
use crate::remote::parse::{probe_identity, require_warmup_id, warmup_ids};
use crate::remote::reporting::warning;

use crate::remote::runner::DefaultRemoteRunner;

impl DefaultRemoteRunner {
    /// Collect every recoverable box even when another warmup fails or is interrupted.
    pub(super) fn warmup(
        &self,
        reference: &str,
        boxes: &mut Vec<String>,
        cleanup: &dyn BoxCleanup,
    ) -> Result<()> {
        let dependencies = &self.dependencies;
        let results = thread::scope(|scope| {
            let workers: Vec<_> = (0..11)
                .map(|_| {
                    scope.spawn(|| {
                        if dependencies.interrupt.requested() {
                            return Err(Error::Interrupted { cleanup: 0 });
                        }
                        let output = dependencies.blacksmith.warmup(reference)?;
                        let text = output.combined();
                        for id in warmup_ids(&text) {
                            cleanup.track(&id);
                            cleanup.record_run(&id, &text);
                        }
                        Ok(output)
                    })
                })
                .collect();
            workers
                .into_iter()
                .map(|worker| match worker.join() {
                    Ok(output) => output,
                    Err(_) => Err(Error::Worker),
                })
                .collect::<Vec<_>>()
        });
        let mut failure = None;
        let mut unique = BTreeSet::new();
        for result in results {
            match result {
                Ok(output) => {
                    let text = output.combined();
                    for id in warmup_ids(&text) {
                        if !unique.insert(id.clone()) {
                            failure.get_or_insert(Error::RepeatedBox { id: id.clone() });
                        }
                        boxes.push(id);
                    }
                    if let Err(error) = success(&output, Operation::Blacksmith)
                        .and_then(|()| require_warmup_id(&text).map(|_| ()))
                    {
                        dependencies
                            .reporter
                            .executor(&warning("warmup failed", &error));
                        for line in text.lines() {
                            dependencies
                                .reporter
                                .executor(&format!("information: warmup output: {line}"));
                        }
                        failure.get_or_insert(error);
                    }
                }
                Err(error) => {
                    failure.get_or_insert(error);
                }
            }
        }
        if dependencies.interrupt.requested() {
            return Err(Error::Interrupted { cleanup: 0 });
        }
        match failure {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }

    /// Probe every box exactly once, with the CLI's ten-minute readiness wait.
    pub(super) fn probe(
        &self,
        boxes: &[String],
        fingerprint: &str,
        head: &str,
        cleanup: &dyn BoxCleanup,
    ) -> Result<()> {
        let dependencies = &self.dependencies;
        let command = format!(
            "node scripts/verification/source-tree.mjs --expect {fingerprint} --print-head"
        );
        let results = thread::scope(|scope| {
            let workers: Vec<_> = boxes
                .iter()
                .map(|id| {
                    let command = &command;
                    scope.spawn(move || {
                        let output = dependencies.blacksmith.run(id, command, None)?;
                        let text = output.combined();
                        cleanup.record_run(id, &text);
                        let identity = success(&output, Operation::Blacksmith)
                            .and_then(|()| probe_identity(&text, fingerprint, head));
                        if let Err(error) = &identity {
                            dependencies
                                .reporter
                                .executor(&warning(&format!("probe box={id} failed"), error));
                            for line in text.lines() {
                                dependencies.reporter.executor(&format!(
                                    "information: probe box={id} output: {line}"
                                ));
                            }
                        }
                        identity
                    })
                })
                .collect();
            workers
                .into_iter()
                .map(|worker| match worker.join() {
                    Ok(output) => output,
                    Err(_) => Err(Error::Worker),
                })
                .collect::<Vec<_>>()
        });
        if dependencies.interrupt.requested() {
            return Err(Error::Interrupted { cleanup: 0 });
        }
        for result in results {
            result?;
        }
        Ok(())
    }
}
