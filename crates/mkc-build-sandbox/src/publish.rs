//! Local CLI discovery, upload-exchange version floor and exact publish argv.

use async_trait::async_trait;
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_build_interface::request::{BuildRequest, Comparison};

use crate::command::{Command, REPO, args, directories, directory};
use crate::process::ProcessDriver;
use crate::session::{probe, require};
use crate::versions::{CLOUD_MOKLY_VERSION, supported};

#[async_trait]
pub(crate) trait Publish: Send + Sync {
    async fn publish(&self, installed: Option<&str>) -> Result<(), BuildOutcome>;
}

pub(crate) struct Publisher<'a> {
    pub(crate) request: &'a BuildRequest,
    pub(crate) process: &'a dyn ProcessDriver,
}

#[async_trait]
impl Publish for Publisher<'_> {
    async fn publish(&self, installed: Option<&str>) -> Result<(), BuildOutcome> {
        let step = BuildStep::Publish;
        let mut local = None;
        for parent in directories(self.request.config_path.as_str()) {
            let cli = format!("{}/node_modules/.bin/mokly", directory(&parent));
            if probe(
                self.process
                    .run(step, Command::new("test", args(&["-x", &cli]), REPO))
                    .await?,
                step,
            )? {
                let result = self
                    .process
                    .run(step, Command::new(&cli, args(&["--version"]), REPO).probe())
                    .await?;
                if result.exit_code != Some(0) || !supported(&result.stdout) {
                    return Err(BuildOutcome::UnsupportedMoklyVersion);
                }
                local = Some(cli);
                break;
            }
            if installed == Some(parent.as_str()) {
                break;
            }
        }
        let mut command = match local {
            Some(cli) => Command::new(&cli, args(&["publish"]), REPO),
            None => Command::new(
                "npm",
                args(&[
                    "exec",
                    "--yes",
                    &format!("--package=@mokly/mokly@{CLOUD_MOKLY_VERSION}"),
                    "--",
                    "mokly",
                    "publish",
                ]),
                REPO,
            ),
        };
        command.args.extend(args(&[
            "--config",
            self.request.config_path.as_str(),
            "--repository",
            &format!("github.com/{}", self.request.repository.as_str()),
        ]));
        command.args.extend(match &self.request.comparison {
            Comparison::CurrentOnly => args(&["--no-changes"]),
            Comparison::Base { base_ref } => {
                args(&["--base", &format!("origin/{}", base_ref.as_str())])
            }
        });
        command.publish = true;
        require(self.process.run(step, command).await?, step)?;
        Ok(())
    }
}
