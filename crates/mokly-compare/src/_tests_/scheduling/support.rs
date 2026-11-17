//! Pure screen recipes and mocked generation IO for the public comparison entrypoint.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::error::GraphError;
use mokly_graph::key::{NodeKind, key};
use mokly_graph::types::{DocumentPlan, RenderGeneration, RenderGenerationMock, RenderSummary};
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use unimock::{MockFn, Unimock, matching};

use crate::capture_generation::CapturedGeneration;
use crate::capture_restore::LosslessRestorer;
use crate::comparison::Engine;
use crate::comparison_capture::CapturedView;
use crate::comparison_types::{Comparison, ComparisonRequest, ComparisonResult};
use crate::moves::Detector;

use super::control::Control;
use super::generation::Generation;
use super::inputs::{artifact, catalogue, closure, index, route};

pub(super) fn source(
    side: usize,
    count: usize,
    control: Arc<Control>,
) -> Arc<dyn RenderGeneration> {
    let plans = (0..count)
        .map(|index| {
            let route = route(index);
            (
                route.clone(),
                DocumentPlan {
                    resource_key: route.clone(),
                    key: key(NodeKind::Document, &[route.as_bytes()]),
                    route,
                    entry: 0,
                    viewport: Some(if index < 2 {
                        Viewport::Mobile
                    } else {
                        Viewport::Desktop
                    }),
                    color_scheme: if index % 2 == 0 {
                        ColorScheme::Light
                    } else {
                        ColorScheme::Dark
                    },
                    stylesheets: vec![],
                },
            )
        })
        .collect::<BTreeMap<_, _>>();
    let initial_cancel = control.cancellation.load(Ordering::SeqCst);
    let active = initial_cancel == 0;
    let stage = control.fail_from.unwrap_or(4);
    let head_document = active && stage >= 1;
    let head_closure =
        head_document && stage >= 3 && !control.has_deferred && control.errors.len() < count;
    let resource =
        active && control.cancel_after_batch == 0 && stage == 4 && !control.errors.contains(&0);
    let base_document = active && (control.fail_from.is_some() || control.restore_source);
    let cancel = control.clone();
    let documents = control.clone();
    let closures = control.clone();
    let resources = control.clone();
    let scheduling = control.clone();
    Arc::new(Generation {
        capacity: control.capacity.unwrap_or(2),
        metadata: Unimock::new((
            RenderGenerationMock::catalogue
                .each_call(matching!())
                .returns(catalogue()),
            RenderGenerationMock::plans
                .each_call(matching!())
                .returns(plans),
        )),
        validation: (side == 2).then(|| {
            Unimock::new(
                RenderGenerationMock::render_all
                    .each_call(matching!())
                    .answers(&|_| Ok(RenderSummary::default())),
            )
        }),
        scheduling: (side == 1 && active).then(|| {
            Unimock::new(
                RenderGenerationMock::schedule_comparison_tasks
                    .each_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, count, task| {
                        scheduling.schedule(count, task)
                    })),
            )
        }),
        cancellation: (side == 1 || initial_cancel != 1).then(|| {
            Unimock::new(
                RenderGenerationMock::check_cancelled
                    .each_call(matching!())
                    .answers_arc(Arc::new(move |_| {
                        if cancel.cancellation.load(Ordering::SeqCst) == side {
                            Err(cancelled(side))
                        } else {
                            Ok(())
                        }
                    })),
            )
        }),
        document: ((side == 1 && base_document) || (side == 2 && head_document)).then(|| {
            Unimock::new(
                RenderGenerationMock::comparison_document
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, route| {
                        let index = index(route);
                        documents.event(format!("document:{side}:{index}"));
                        let stage = side - 1;
                        if documents.fail_from.is_some_and(|first| stage >= first) {
                            return Err(failure("stage", stage));
                        }
                        if side == 2 && documents.errors.contains(&index) {
                            return Err(failure("phase-a", index));
                        }
                        let artifact = artifact(index);
                        if side == 2 {
                            documents
                                .artifacts
                                .lock()
                                .unwrap()
                                .push(Arc::downgrade(&artifact));
                            let gate = documents.gate.lock().unwrap().clone();
                            if let Some(gate) = gate {
                                gate.wait();
                            }
                        }
                        Ok(artifact)
                    })),
            )
        }),
        closure: ((side == 1 && base_document && stage >= 2 && control.fail_from.is_some())
            || (side == 2 && head_closure))
            .then(|| {
                Unimock::new(
                    RenderGenerationMock::closure
                        .each_call(matching!(_))
                        .answers_arc(Arc::new(move |_, route| {
                            let index = index(route);
                            closures.event(format!("closure:{side}:{index}"));
                            let stage = side + 1;
                            if closures.fail_from.is_some_and(|first| stage >= first) {
                                Err(failure("stage", stage))
                            } else {
                                Ok(closure(index))
                            }
                        })),
                )
            }),
        resources: (resource && (side == 1 || resources.resource_error.is_none())).then(|| {
            Unimock::new(
                RenderGenerationMock::resource_digest
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, route| {
                        let index = index(route);
                        if side == 1 {
                            resources.live.lock().unwrap().push(resources.live());
                        }
                        resources.event(format!("resource:{side}:{index}"));
                        if resources.cancel_in_view != 0 {
                            resources
                                .cancellation
                                .store(resources.cancel_in_view, Ordering::SeqCst);
                        }
                        if resources.resource_error == Some(index) {
                            Err(failure("phase-b", index))
                        } else {
                            Ok(Some("same".into()))
                        }
                    })),
            )
        }),
    })
}

pub(super) fn captured(
    source: Arc<dyn RenderGeneration>,
    indices: &[usize],
) -> Arc<dyn RenderGeneration> {
    Arc::new(CapturedGeneration {
        source,
        views: indices
            .iter()
            .map(|&index| {
                (
                    route(index),
                    CapturedView {
                        document: EncodedView::encode(&artifact(index)).unwrap(),
                        closure: closure(index),
                    },
                )
            })
            .collect(),
        summary: RenderSummary::default(),
        styles: BTreeMap::new(),
        retained_bytes: 0,
        encoded_bytes: 0,
        restorer: Box::new(LosslessRestorer),
    })
}

pub(super) fn compare(
    before: Arc<dyn RenderGeneration>,
    after: Arc<dyn RenderGeneration>,
) -> crate::error::Result<ComparisonResult> {
    Engine {
        moves: Arc::new(Detector),
        css: Arc::new(MemoryParsedCss::new(4096)),
    }
    .compare_prepared(
        &ComparisonRequest {
            base_ref: "base".into(),
            base_commit: "b".repeat(40),
            catalogue_identity: "a".repeat(64),
        },
        before,
        after,
    )
}

pub(super) fn failure(phase: &str, index: usize) -> GraphError {
    GraphError::InputsChanged {
        path: format!("{phase}-{index}").into(),
    }
}
pub(super) fn cancelled(side: usize) -> GraphError {
    GraphError::Runtime {
        source: RuntimeDiagnostic {
            code: RuntimeCode::Cancelled,
            message: format!("cancelled side {side}"),
        },
    }
}
