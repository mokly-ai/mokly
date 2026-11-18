//! Classification selects one kept base or makes one fresh captured generation.

use std::sync::Arc;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_graph::types::RenderGeneration;
use mokly_model::material::catalogue_key;

use crate::base_reader::BaseReader;
use crate::base_render::{Changes, selected_base};
use crate::base_retention::{BaseRetentionRequest, BaseReuse, KeptBase};
use crate::comparison_steps::Step;
use crate::comparison_types::{ComparisonRequest, ComparisonResult};
use crate::error::{Error, Result};

pub(super) struct Attempt {
    pub(super) base: Arc<KeptBase>,
    pub(super) reuse: Option<BaseReuse>,
    pub(super) fallback: bool,
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

pub(super) fn base_error(commit: &str, scripts_off: bool, source: Error) -> Error {
    Error::Base {
        commit: commit.into(),
        scripts_off,
        source: Box::new(source),
    }
}
