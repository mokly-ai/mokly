//! Captured install inputs enforce offline execution and private storage.

use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::path::Path;
use std::process;
use std::time::Duration;

use crate::commands::Command;
use crate::manager::{Manager, Root};
use crate::manager_command::{arguments, environment};

#[test]
fn manager_install_flags_disable_network_scripts_and_external_storage() {
    for manager in [Manager::Pnpm, Manager::YarnClassic, Manager::YarnBerry] {
        let root = Root {
            directory: "frontend".into(),
            manager,
            requested: None,
            version: String::new(),
        };
        let args = arguments(&root, Path::new("/private"));
        if manager == Manager::Pnpm {
            assert!(
                args.iter()
                    .any(|arg| arg == "--config.modules-dir=node_modules")
            );
            assert!(
                args.iter()
                    .any(|arg| arg == "--store-dir=/private/frontend/.pnpm-store")
            );
        }
        if manager == Manager::YarnBerry {
            assert!(args.iter().any(|arg| arg == "--mode=skip-build"));
            assert!(args.iter().any(|arg| arg == "--immutable"));
        } else {
            for flag in ["--offline", "--frozen-lockfile", "--ignore-scripts"] {
                assert!(args.iter().any(|arg| arg == flag));
            }
            assert!(
                args.iter()
                    .filter(|arg| Path::new(arg).is_absolute())
                    .all(|arg| Path::new(arg).starts_with("/private/frontend"))
            );
        }
        let request = Command {
            program: manager.program().into(),
            args,
            directory: "/private/frontend".into(),
            timeout: Duration::from_secs(10),
            byte_limit: Some(1000),
            size_root: Some("/private".into()),
        };
        let mut command = process::Command::new(manager.program());
        environment(&request, &mut command);
        let captured = command.get_envs().collect::<BTreeMap<_, _>>();
        assert_eq!(
            captured[OsStr::new("GIT_ALLOW_PROTOCOL")],
            Some(OsStr::new(""))
        );
        for key in [
            "COREPACK_ENABLE_NETWORK",
            "COREPACK_ENABLE_AUTO_PIN",
            "COREPACK_DEFAULT_TO_LATEST",
            "COREPACK_ENV_FILE",
        ] {
            assert_eq!(captured[OsStr::new(key)], Some(OsStr::new("0")));
        }
        if manager == Manager::YarnBerry {
            for key in [
                "YARN_ENABLE_NETWORK",
                "YARN_ENABLE_SCRIPTS",
                "YARN_ENABLE_TELEMETRY",
                "YARN_ENABLE_MIRROR",
                "YARN_ENABLE_GLOBAL_CACHE",
            ] {
                assert_eq!(captured[OsStr::new(key)], Some(OsStr::new("0")));
            }
            for key in [
                "YARN_CACHE_FOLDER",
                "YARN_GLOBAL_FOLDER",
                "YARN_INSTALL_STATE_PATH",
            ] {
                assert!(
                    Path::new(captured[OsStr::new(key)].unwrap()).starts_with("/private/frontend")
                );
            }
        }
    }
}
