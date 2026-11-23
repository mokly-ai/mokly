//! Mocked rendering boundaries supply complete recipes and independent resource identities.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_graph::comparison_proof::{ComparisonRead, DocumentProof, ProofMode, content_identity};
use mokly_graph::key::{NodeKind, key};
use mokly_graph::types::{DocumentPlan, RenderGeneration, RenderGenerationMock, RenderSummary};
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::material::digest;
use unimock::{MockFn, Unimock, matching};

use super::fixture::Fixture;

impl Fixture {
    pub(super) fn generation(&self, head: bool) -> Arc<dyn RenderGeneration> {
        let generation: Arc<dyn RenderGeneration> = Arc::new(self.mock(head));
        if let Some(route) = generation.plans().keys().next() {
            let _ = generation.comparison_document_proof(route);
        }
        generation
    }

    /// The same boundaries for a test that publishes without the captures, which alone render
    /// every mocked document, so the mock does not check its unused clauses.
    pub(super) fn published_generation(&self, head: bool) -> Arc<dyn RenderGeneration> {
        Arc::new(self.mock(head).no_verify_in_drop())
    }

    fn mock(&self, head: bool) -> Unimock {
        let plans: BTreeMap<_, _> = self
            .entries
            .iter()
            .enumerate()
            .flat_map(|(entry, model)| {
                [Viewport::Mobile, Viewport::Desktop]
                    .into_iter()
                    .map(move |viewport| {
                        let path = &model.metadata.path;
                        let route = mokly_model::routes::view(path, viewport, ColorScheme::Light);
                        let recipe = serde_json::to_vec(&(
                            &self.html[path],
                            &self.label,
                            &self.ignored,
                            self.review_ignore,
                            &self.badge,
                            viewport,
                        ))
                        .unwrap();
                        (
                            route.clone(),
                            DocumentPlan {
                                resource_key: path.clone(),
                                key: key(NodeKind::Document, &[&recipe]),
                                route,
                                entry,
                                viewport: Some(viewport),
                                color_scheme: ColorScheme::Light,
                                stylesheets: vec![],
                            },
                        )
                    })
            })
            .collect();
        let catalogue = self.catalogue();
        let documents = self.clone();
        let renders = self.clone();
        let closures = self.clone();
        let proof = self.clone();
        let resources = self.resources.clone();
        let digests = self.resources.clone();
        let common = (
            RenderGenerationMock::comparison_document_proof
                .each_call(matching!(_))
                .answers(&|source, route| {
                    let artifact = source.comparison_document(route).ok()?;
                    let identity = source.comparison_identity(
                        ComparisonRead::Document,
                        route,
                        ProofMode::Current,
                    )?;
                    Some(DocumentProof {
                        identity,
                        usage: artifact
                            .document
                            .as_ref()
                            .map(|document| document.usage.clone()),
                    })
                }),
            RenderGenerationMock::catalogue
                .each_call(matching!())
                .returns(catalogue)
                .at_least_times(0),
            RenderGenerationMock::plans
                .each_call(matching!())
                .returns(plans)
                .at_least_times(0),
            RenderGenerationMock::check_cancelled
                .each_call(matching!())
                .answers(&|_| Ok(()))
                .at_least_times(0),
            RenderGenerationMock::comparison_document
                .each_call(matching!(_))
                .answers_arc(Arc::new(
                    move |_, route| Ok(documents.artifact(path(route))),
                ))
                .at_least_times(0),
            RenderGenerationMock::render
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, route| Ok(renders.artifact(path(route)))))
                .at_least_times(0),
            RenderGenerationMock::closure
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, route| Ok(closures.closure(path(route)))))
                .at_least_times(0),
            RenderGenerationMock::resource_bytes
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, route| Ok(resources.get(route).cloned())))
                .at_least_times(0),
            RenderGenerationMock::resource_digest
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, route| {
                    Ok(digests.get(route).map(|bytes| digest(bytes)))
                }))
                .at_least_times(0),
            RenderGenerationMock::comparison_identity
                .each_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, read, route, _| {
                    if !proof.known {
                        return None;
                    }
                    Some(match read {
                        ComparisonRead::Document | ComparisonRead::Closure => content_identity(
                            &serde_json::to_vec(&(
                                &proof.html[path(route)],
                                &proof.badge,
                                &proof.label,
                                &proof.ignored,
                                proof.review_ignore,
                            ))
                            .unwrap(),
                        ),
                        ComparisonRead::Resource => content_identity(
                            &serde_json::to_vec(&proof.resources.get(route)).unwrap(),
                        ),
                    })
                }))
                .at_least_times(0),
        );
        let generation = digest(
            &serde_json::to_vec(&(
                &self.html,
                &self.resources,
                &self.entries,
                self.review_ignore,
            ))
            .unwrap(),
        );
        let identity = RenderGenerationMock::generation_key
            .each_call(matching!())
            .returns(generation);
        let validation = RenderGenerationMock::render_all
            .each_call(matching!())
            .answers(&|_| Ok(RenderSummary::default()))
            .at_least_times(0);
        if head {
            Unimock::new((common, validation, identity))
        } else {
            Unimock::new(common)
        }
    }
}
fn path(route: &str) -> &str {
    route.rsplit_once('/').unwrap().0
}
