//! The final output identity and directory guards run before receiver requests.

use std::path::PathBuf;
use std::sync::Arc;

use crate::publication::error::Error;
use mokly_model::output::artifact::Artifact;
use mokly_model::output::validation::{MANIFEST, MARKER};
use mokly_publish::checkout::{CheckoutMock, Inspection};
use mokly_publish::error;
use mokly_publish::snapshot::{Finalized, OutputSnapshot};
use unimock::{MockFn, Unimock, matching};

use crate::publication::build::{DirectoriesMock, StaticOutputMock};
use crate::publication::command::{BuildReporterMock, Command, Options, Publish};

use super::support::{active, artifact, inventory, publication, settings};

#[tokio::test]
async fn directory_and_metadata_mismatches_fail_before_plan() {
    for mismatch in [
        "directory",
        "head",
        "repository",
        "branch",
        "version",
        "pull-request",
        "comparison",
    ] {
        let mut output = artifact(mismatch == "comparison");
        if mismatch == "directory" {
            output.directory = "/different".into();
        } else if mismatch != "comparison" {
            let mut identity = publication();
            match mismatch {
                "head" => identity.head_sha = "b".repeat(40),
                "repository" => identity.repository.name = "different".to_owned(),
                "branch" => identity.branch = "different".to_owned(),
                "version" => identity.mokly_version = "9.0.0".to_owned(),
                "pull-request" => identity.pull_request = Some(99),
                _ => unreachable!(),
            }
            let files = output
                .files
                .into_iter()
                .filter(|file| file.path != MARKER && file.path != MANIFEST)
                .collect();
            output = Artifact::finalize(
                output.directory,
                files,
                Some(identity.metadata(&inventory(false)).unwrap()),
            )
            .unwrap();
        }
        let finalised: Arc<dyn OutputSnapshot> = Arc::new(Finalized::new(output).unwrap());
        let checkout = if mismatch == "directory" {
            Unimock::new((
                CheckoutMock::inspect
                    .next_call(matching!(_, _, _))
                    .returns(Ok(inspection())),
                CheckoutMock::publication
                    .next_call(matching!(_, _, _, _, _))
                    .returns(Ok(publication())),
            ))
        } else {
            Unimock::new((
                CheckoutMock::inspect
                    .next_call(matching!(_, _, _))
                    .returns(Ok(inspection())),
                CheckoutMock::publication
                    .next_call(matching!(_, _, _, _, _))
                    .returns(Ok(publication())),
                CheckoutMock::inspect
                    .next_call(matching!(_, _, _))
                    .returns(Ok(inspection())),
            ))
        };
        let mock = Arc::new(Unimock::new((
            DirectoriesMock::create
                .next_call(matching!(_))
                .returns(Ok(PathBuf::from("/private/publish"))),
            BuildReporterMock::build_directory
                .next_call(matching!(_))
                .returns(()),
            StaticOutputMock::build
                .next_call(matching!(_, _))
                .returns(Ok(finalised)),
        )));
        let command: &dyn Publish = &Command {
            checkout: Arc::new(checkout),
            directories: mock.clone(),
            output: mock.clone(),
            reporter: mock,
            exchange: Arc::new(Unimock::new(())),
        };
        let options = Options {
            directory: "/repo/tools".into(),
            version: publication().mokly_version,
            repository: None,
            actions: Default::default(),
            config: None,
            base: None,
            no_changes: true,
            strict: false,
            owned_paths: Vec::new(),
        };
        assert!(
            matches!(
                command.run(&options, &settings(8), &active()).await,
                Err(Error::Exchange {
                    source: error::Error::InvalidBundle
                })
            ),
            "{mismatch}"
        );
    }
}

fn inspection() -> Inspection {
    Inspection {
        root: "/repo".into(),
        head_sha: "a".repeat(40),
        changed_paths: Vec::new(),
        build_directories: Vec::new(),
    }
}
