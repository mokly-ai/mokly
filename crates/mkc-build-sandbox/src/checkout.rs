//! Exact Git checkout and comparison fetch ladder.

use async_trait::async_trait;
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_build_interface::request::{BuildRequest, Comparison};

use crate::command::{CREDENTIAL, Command, REPO, args};
use crate::process::ProcessDriver;
use crate::session::{probe, require};

#[async_trait]
pub(crate) trait Checkout: Send + Sync {
    async fn checkout(&self) -> Result<(), BuildOutcome>;
}

pub(crate) struct CheckoutRunner<'a> {
    pub(crate) request: &'a BuildRequest,
    pub(crate) process: &'a dyn ProcessDriver,
}

#[async_trait]
impl Checkout for CheckoutRunner<'_> {
    async fn checkout(&self) -> Result<(), BuildOutcome> {
        let step = BuildStep::Checkout;
        for command in [
            Command::new("git", args(&["init", "--quiet", REPO]), "/workspace"),
            Command::new(
                "git",
                args(&[
                    "config",
                    "--local",
                    "credential.helper",
                    &format!("store --file={CREDENTIAL}"),
                ]),
                REPO,
            ),
            Command::new(
                "git",
                args(&[
                    "remote",
                    "add",
                    "origin",
                    &format!(
                        "https://github.com/{}.git",
                        self.request.repository.as_str()
                    ),
                ]),
                REPO,
            ),
            fetch(self.request, "--depth=50"),
        ] {
            require(self.process.run(step, command).await?, step)?;
        }
        if let Comparison::Base { base_ref } = &self.request.comparison {
            let merge = || {
                Command::new(
                    "git",
                    args(&[
                        "merge-base",
                        "--",
                        &format!("origin/{}", base_ref.as_str()),
                        self.request.head_sha.as_str(),
                    ]),
                    REPO,
                )
                .probe()
            };
            if !probe(self.process.run(step, merge()).await?, step)? {
                require(
                    self.process
                        .run(step, fetch(self.request, "--deepen=1000"))
                        .await?,
                    step,
                )?;
                if !probe(self.process.run(step, merge()).await?, step)? {
                    let result = require(
                        self.process
                            .run(
                                step,
                                Command::new(
                                    "git",
                                    args(&["rev-parse", "--is-shallow-repository"]),
                                    REPO,
                                )
                                .probe(),
                            )
                            .await?,
                        step,
                    )?;
                    if result.stdout.as_slice().trim_ascii() == b"true" {
                        require(
                            self.process
                                .run(step, fetch(self.request, "--unshallow"))
                                .await?,
                            step,
                        )?;
                    }
                }
            }
        }
        require(
            self.process
                .run(
                    step,
                    Command::new(
                        "git",
                        args(&[
                            "checkout",
                            "--quiet",
                            "--force",
                            "-B",
                            self.request.branch.as_str(),
                            self.request.head_sha.as_str(),
                            "--",
                        ]),
                        REPO,
                    ),
                )
                .await?,
            step,
        )?;
        Ok(())
    }
}

fn fetch(request: &BuildRequest, depth: &str) -> Command {
    let mut argv = args(&[
        "fetch",
        "--no-tags",
        "--progress",
        depth,
        "origin",
        request.head_sha.as_str(),
    ]);
    if let Comparison::Base { base_ref } = &request.comparison {
        argv.push(format!(
            "+refs/heads/{0}:refs/remotes/origin/{0}",
            base_ref.as_str()
        ));
    }
    Command::new("git", argv, REPO)
}
