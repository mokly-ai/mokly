//! Independent source work records the exact inputs before head-dependent selection.

use std::sync::{Arc, Mutex};

use mokly_compare::base_render::{BasePreparationError, selected_base};
use mokly_compare::base_sources::BaseSourcesRequest;
use mokly_compare::inputs::Inputs;
use mokly_git::repository::Repository;
use mokly_git::tree::Limits;

use crate::serve_base::KeptState;
use crate::serve_base_key::BaseKey;
use crate::serve_eager_evidence::NativeEvidence;
use crate::serve_eager_task::{PreparationWork, SourceCompletion};
use crate::serve_eager_work::{Context, NativePreparation, WorkState};

impl NativePreparation {
    fn snapshot(&self, repository: &dyn Repository, base: &Inputs) -> Option<Inputs> {
        match self.working.read(repository, base, Limits::default()) {
            Ok(inputs) => Some(inputs),
            Err(error) => {
                tracing::debug!(%error, "eager working evidence is unavailable");
                None
            }
        }
    }

    pub(super) fn source_phase(&self) -> SourceCompletion {
        let _activity = self.activity.enter();
        if self.origin.cancelled() {
            return SourceCompletion::Finished;
        }
        let selected = match self.lookup.pin(
            &self.config.repo_root,
            selected_base(&self.config, self.base.as_deref()),
        ) {
            Ok(selected) => selected,
            Err(error) => {
                self.failed(error);
                return SourceCompletion::Finished;
            }
        };
        let key = match BaseKey::selected(&selected, &self.config, self.install_scripts) {
            Ok(key) => key,
            Err(error) => {
                self.failed(error);
                return SourceCompletion::Finished;
            }
        };
        let availability = self.availability.state(&key);
        if availability == KeptState::Matching {
            return SourceCompletion::Finished;
        }
        let services = self.providers.create();
        let checkout = match services
            .provider
            .checkout(selected.repository.as_ref(), &selected.commit)
        {
            Ok(checkout) => checkout,
            Err(error) => {
                self.failed(error);
                return SourceCompletion::Finished;
            }
        };
        if checkout.as_ref().is_none_or(|checkout| checkout.filtered) {
            return SourceCompletion::Finished;
        }
        let mut evidence = NativeEvidence {
            key,
            checkout: checkout.clone(),
            inputs: None,
            working: self.working.clone(),
            head: Mutex::new(None),
        };
        let sources = match self.sources.create(
            selected.repository.clone(),
            selected.commit.clone(),
            &self.config.repo_root,
        ) {
            Ok(sources) => sources,
            Err(source) => {
                evidence.inputs = self.snapshot(selected.repository.as_ref(), &Inputs::default());
                let evidence = Arc::new(evidence);
                *self.guard.lock().unwrap_or_else(|error| error.into_inner()) =
                    Some(evidence.clone());
                *self.state.lock().unwrap_or_else(|error| error.into_inner()) =
                    Some(WorkState::Failed {
                        evidence,
                        services,
                        source,
                    });
                return SourceCompletion::Finished;
            }
        };
        let prepared = services.provider.sources(
            &BaseSourcesRequest {
                working_config: &self.config,
                repository: selected.repository.clone(),
                commit: selected.commit.clone(),
                sources: &sources,
                install_scripts: self.install_scripts,
                steps: self.events.clone(),
            },
            checkout,
            Some(services.source_admission.clone()),
        );
        let root = prepared
            .as_ref()
            .ok()
            .and_then(|source| source.dependencies.as_ref())
            .map(|dependencies| dependencies.sources.directory.clone());
        evidence.inputs = prepared
            .as_ref()
            .ok()
            .and_then(|source| source.dependencies.as_ref())
            .map(|dependencies| dependencies.head.clone())
            .or_else(|| self.snapshot(selected.repository.as_ref(), &Inputs::default()));
        services.validation.inputs(evidence.inputs.is_some());
        let evidence = Arc::new(evidence);
        *self.guard.lock().unwrap_or_else(|error| error.into_inner()) = Some(evidence.clone());
        if let Some(root) = &root {
            self.diagnostics.prepare(root, self.events.clone());
        }
        let context = Context {
            selected,
            sources,
            services,
            evidence,
            root,
        };
        let (state, completion) = match prepared {
            Ok(prepared) => (
                WorkState::Source {
                    context,
                    prepared: Box::new(prepared),
                },
                SourceCompletion::Head {
                    classification: availability == KeptState::Different,
                },
            ),
            Err(source) => (
                WorkState::Ready {
                    context,
                    prepared: Err(BasePreparationError::new(false, source)),
                },
                SourceCompletion::Finished,
            ),
        };
        *self.state.lock().unwrap_or_else(|error| error.into_inner()) = Some(state);
        completion
    }
}
