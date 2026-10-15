//! Cancellation fences both sides of comparison without elapsed-time assertions.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoaderMock;
use mokly_catalogue::error::CatalogueError;
use mokly_catalogue::preparation::CatalogueBuilderMock;
use mokly_compare::base_render::{ChangesService, ChangesServiceMock};
use mokly_compare::error::Error;
use mokly_graph::types::{GraphFactoryMock, RenderGenerationMock, RenderGraphMock, RenderSummary};
use mokly_sidecar::workers::ClockMock;
use unimock::{MockFn, Unimock, matching};

use crate::build::{BuildError, BuildService, CatalogueBuild};
use crate::cancellation::{BuildCancellation, Cancellation};

use super::build_tests::{config, options, prepared};

#[test]
fn an_interrupt_before_or_during_classification_cannot_publish_changes() {
    for before in [true, false] {
        let cancellation: Arc<dyn Cancellation> = Arc::new(BuildCancellation::new(Arc::new(
            Unimock::new(ClockMock::now_ms.next_call(matching!()).returns(0_u64)),
        )));
        let interrupt = cancellation.clone();
        let generation_mock = Unimock::new(
            RenderGenerationMock::render_all
                .next_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    if before {
                        interrupt.interrupt();
                    }
                    Ok(RenderSummary::default())
                })),
        );
        let graph_mock = Unimock::new(
            RenderGraphMock::prepare
                .next_call(matching!(_, _, _))
                .returns(Ok(Arc::new(generation_mock.clone())
                    as Arc<dyn mokly_graph::types::RenderGeneration>)),
        );
        let factory = Unimock::new(GraphFactoryMock::create.next_call(matching!(_)).returns(Ok(
            Arc::new(graph_mock.clone()) as Arc<dyn mokly_graph::types::RenderGraph>,
        )));
        let interrupt = cancellation.clone();
        let changes: Arc<dyn ChangesService> = if before {
            Arc::new(Unimock::new(()))
        } else {
            Arc::new(Unimock::new(
                ChangesServiceMock::classify
                    .next_call(matching!(_, _, _))
                    .answers_arc(Arc::new(move |_, _, _, _| {
                        interrupt.interrupt();
                        Err(Error::Base {
                            commit: "a".repeat(40),
                            source: Box::new(Error::Catalogue {
                                source: CatalogueError::Invalid {
                                    issues: Vec::new(),
                                    warnings: Vec::new(),
                                },
                            }),
                        })
                    })),
            ))
        };
        let service: &dyn BuildService = &CatalogueBuild {
            cancellation,
            changes,
            graphs: Arc::new(factory),
            config: Arc::new(Unimock::new(
                ConfigLoaderMock::load
                    .next_call(matching!(_, _))
                    .returns(Ok(config())),
            )),
            catalogue: Arc::new(Unimock::new(
                CatalogueBuilderMock::prepare
                    .next_call(matching!(_, _))
                    .returns(Ok(prepared(Vec::new()))),
            )),
        };
        let mut options = options();
        options.no_changes = false;
        assert!(matches!(
            service.run(Path::new("/repo"), &options),
            Err(BuildError::Cancelled)
        ));
    }
}
