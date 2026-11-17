//! Match protocol pins, workspace versions, image sources, and installed tools.

use std::path::Path;
use std::sync::Arc;

use crate::command::CommandSpec;
use crate::error::{Error, Result, reject};

use super::environment::{Environment, text};
use super::{build_pins, pins};

pub(super) struct ToolchainCheck {
    pub(super) environment: Arc<dyn Environment>,
}

#[cfg(test)]
#[path = "_tests_/toolchain_tests.rs"]
mod toolchain_tests;

impl ToolchainCheck {
    pub(super) fn check(&self) -> Result<()> {
        let environment = self.environment.as_ref();
        let protocol = text(environment, "docs/protocol/cloud/repository-layout.md")?;
        let pins = match pins::protocol(&protocol) {
            Ok(pins) => pins,
            Err(violations) => return Err(Error::Violations(violations)),
        };
        let mut violations = pins::rust(&text(environment, "rust-toolchain.toml")?, &pins)?;
        let node = text(environment, ".nvmrc")?;
        violations.extend(pins::compare(".nvmrc", "version", &pins.node, node.trim()));
        let dockerfile = text(environment, "infra/e2b/build/e2b.Dockerfile")?;
        violations.extend(build_pins::e2b_node(&dockerfile, &node));
        violations.extend(build_pins::e2b_base(&dockerfile));
        violations.extend(pins::package(
            Path::new("package.json"),
            &text(environment, "package.json")?,
            &pins,
        )?);
        environment
            .output(&CommandSpec::new("node").args(["xtask/scripts/node-pin.mjs", &pins.node]))?;
        let versions = text(environment, "crates/mkc-build-sandbox/src/versions.rs")?;
        violations.extend(build_pins::mokly(
            &text(environment, "packages/mokly/package.json")?,
            &versions,
        )?);
        for path in [
            "docs/protocol/cloud/viewer-builds.md",
            "apps/app/src/viewer/build-copy.ts",
            "docs/mockups/src/fixtures/build-copy.ts",
        ] {
            violations.extend(build_pins::failure_sentence(
                path,
                &text(environment, path)?,
                &versions,
            ));
        }
        violations.extend(pins::infrastructure(
            &text(environment, "infra/toolchains.json")?,
            &pins,
        )?);
        let terraform =
            environment.output(&CommandSpec::new("terraform").args(["version", "-json"]))?;
        violations.extend(pins::compare(
            "terraform",
            "installed version",
            &pins.terraform,
            &pins::terraform_version(&terraform)?,
        ));
        let helm = environment.output(&CommandSpec::new("helm").args([
            "version",
            "--template",
            "{{.Version}} ",
        ]))?;
        violations.extend(pins::compare(
            "helm",
            "installed version",
            &pins.helm,
            helm.trim().trim_start_matches('v'),
        ));
        for (program, expected) in [("rustc", pins.rust), ("node", pins.node), ("npm", pins.npm)] {
            let output = environment.output(&CommandSpec::new(program).args(["--version"]))?;
            let actual = if program == "rustc" {
                output.split_whitespace().nth(1).unwrap_or_default()
            } else {
                output.trim().trim_start_matches('v')
            };
            violations.extend(pins::compare(
                program,
                "installed version",
                &expected,
                actual,
            ));
        }
        reject(violations)
    }
}
