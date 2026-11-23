//! Classification selects one kept base or makes one fresh captured generation.

use std::sync::Arc;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_graph::types::RenderGeneration;
use mokly_model::material::catalogue_key;

use crate::base_reader::BaseReader;
use crate::base_render::{BaseRequest, Changes, selected_base};
use crate::base_retention::{BaseRetentionRequest, BaseReuse, KeptBase};
use crate::comparison_steps::Step;
use crate::comparison_types::{ComparisonRequest, ComparisonResult};
use crate::error::{Error, Result};

struct Attempt {
    base: Arc<KeptBase>,
    reuse: Option<BaseReuse>,
    fallback: bool,
}

struct Compared {
    result: Result<ComparisonResult>,
    prepare: bool,
}

impl Changes {
    pub(crate) fn classify_base(
        &self,
        config: &ResolvedConfig,
        base: Option<&str>,
        head: Arc<dyn RenderGeneration>,
        install_scripts: Option<bool>,
    ) -> Result<ComparisonResult> {
        self.steps.step(Step::Reading);
        let selected = match &self.pinned {
            Some(pinned) => pinned.clone(),
            None => self
                .lookup
                .pin(&config.repo_root, selected_base(config, base))?,
        };
        let request = BaseRetentionRequest {
            selected: &selected,
            working_config: config,
            head: head.as_ref(),
            install_scripts: install_scripts
                .or_else(|| {
                    config
                        .input
                        .review
                        .as_ref()
                        .and_then(|review| review.base_install_scripts)
                })
                .unwrap_or(false),
        };
        let comparison = ComparisonRequest {
            base_ref: selected.reference.clone(),
            base_commit: selected.commit.to_string(),
            catalogue_identity: catalogue_key(&relative(&config.file, &config.repo_root)),
        };
        let attempt = {
            let span = tracing::info_span!(
                "review.base-tree",
                action = tracing::field::Empty,
                status = "error"
            );
            let _scope = span.enter();
            let attempt = match self.provider.find_kept(&request)? {
                Some(reuse) => {
                    span.record("action", "reuse");
                    Attempt {
                        base: reuse.base.clone(),
                        reuse: Some(reuse),
                        fallback: true,
                    }
                }
                None => {
                    span.record("action", "prepare");
                    self.prepare_attempt(&request)?
                }
            };
            span.record("status", "ok");
            attempt
        };
        {
            let compared = self.compare_attempt(&comparison, attempt, head.clone());
            if !compared.prepare {
                return compared.result;
            }
        }
        let attempt = {
            let span =
                tracing::info_span!("review.base-tree", action = "prepare", status = "error");
            let _scope = span.enter();
            let attempt = self.prepare_attempt(&request)?;
            span.record("status", "ok");
            attempt
        };
        self.compare_attempt(&comparison, attempt, head).result
    }

    fn prepare_attempt(&self, request: &BaseRetentionRequest<'_>) -> Result<Attempt> {
        let commit = &request.selected.commit;
        let sources = match self.provider.historical_sources(request)? {
            Some(sources) => sources,
            None => self.sources.create(
                request.selected.repository.clone(),
                commit.clone(),
                &request.working_config.repo_root,
            )?,
        };
        let failures = sources.failures.clone();
        let prepared = self.provider.prepare(&BaseRequest {
            head: request.head,
            working_config: request.working_config,
            repository: request.selected.repository.clone(),
            commit: commit.clone(),
            sources,
            install_scripts: request.install_scripts,
            steps: self.steps.clone(),
        });
        let scripts_off = prepared
            .as_ref()
            .map_or_else(|error| error.scripts_off, |base| base.scripts_off);
        if let Some(source) = failures.failure() {
            return Err(base_error(
                &commit.to_string(),
                scripts_off,
                Error::SourceFailure { source },
            ));
        }
        let prepared = match prepared {
            Ok(prepared) => prepared,
            Err(error) => {
                return Err(base_error(&commit.to_string(), scripts_off, *error.source));
            }
        };
        let captured = {
            let _prefetch = prepared.prefetch;
            self.comparison.capture_base(prepared.generation)
        };
        if let Some(source) = failures.failure() {
            return Err(base_error(
                &commit.to_string(),
                scripts_off,
                Error::SourceFailure { source },
            ));
        }
        let generation = match captured {
            Ok(generation) => generation,
            Err(source) => return Err(base_error(&commit.to_string(), scripts_off, source)),
        };
        let base = Arc::new(KeptBase {
            generation,
            failures,
            scripts_off,
            freshness: prepared.freshness,
        });
        let reuse = match self.provider.keep(request, base.clone()) {
            Ok(reuse) => reuse,
            Err(source) => {
                self.provider.release(&base);
                return Err(base_error(&commit.to_string(), scripts_off, source));
            }
        };
        Ok(Attempt {
            base,
            reuse,
            fallback: false,
        })
    }

    fn compare_attempt(
        &self,
        request: &ComparisonRequest,
        attempt: Attempt,
        head: Arc<dyn RenderGeneration>,
    ) -> Compared {
        let base = attempt.base;
        if attempt.fallback
            && let Some(source) = base.failures.failure()
        {
            self.provider.release(&base);
            return Compared {
                result: Err(base_error(
                    &request.base_commit,
                    base.scripts_off,
                    Error::SourceFailure { source },
                )),
                prepare: false,
            };
        }
        let reader = attempt.reuse.map(|reuse| Arc::new(BaseReader::new(reuse)));
        let before: Arc<dyn RenderGeneration> = match &reader {
            Some(reader) => reader.clone(),
            None => base.generation.clone(),
        };
        self.steps.step(Step::Comparing);
        let result = self.comparison.compare_prepared(request, before, head);
        let source_failure = base.failures.failure();
        let reader_failed = reader.as_ref().is_some_and(|reader| reader.failed());
        if reader_failed && attempt.fallback {
            return Compared {
                result,
                prepare: true,
            };
        }
        if let Some(source) = source_failure {
            if !reader_failed {
                self.provider.release(&base);
            }
            return Compared {
                result: Err(base_error(
                    &request.base_commit,
                    base.scripts_off,
                    Error::SourceFailure { source },
                )),
                prepare: false,
            };
        }
        Compared {
            result: result.map(|mut result| {
                result.warnings.extend(base.failures.warnings());
                mokly_catalogue::diagnostic::normalize_warnings(&mut result.warnings);
                result
            }),
            prepare: false,
        }
    }
}

fn base_error(commit: &str, scripts_off: bool, source: Error) -> Error {
    Error::Base {
        commit: commit.into(),
        scripts_off,
        source: Box::new(source),
    }
}
