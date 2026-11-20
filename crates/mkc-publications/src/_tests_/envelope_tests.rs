//! Portable envelope identities authorize only the stored repository and config.

use crate::envelope::authorize;
use crate::error::Error;

use super::support::{bundle, project};

#[test]
fn canonical_identity_matches_each_host_case_insensitively_and_keeps_group_paths() {
    for (host, owner, name, stored) in [
        (
            "github.com",
            "Mokly-AI",
            "Mokly-Cloud",
            "mokly-ai/mokly-cloud",
        ),
        (
            "gitlab.com",
            "Team/Subgroup",
            "Catalogue",
            "gitlab.com/team/subgroup/catalogue",
        ),
        (
            "192.168.1.2",
            "TEAM",
            "Catalogue.git",
            "192.168.1.2/team/catalogue.git",
        ),
    ] {
        let mut manifest = bundle().manifest().clone();
        manifest.repository.host = host.into();
        manifest.repository.owner = owner.into();
        manifest.repository.name = name.into();
        let mut project = project();
        project.repository = stored.to_ascii_uppercase();
        assert!(authorize(&project, &manifest).is_ok());
        manifest.repository.host = "other.example".into();
        assert!(matches!(
            authorize(&project, &manifest),
            Err(Error::Forbidden)
        ));
        manifest.repository.host = host.into();
        manifest.config_path = "other.config.json".into();
        assert!(matches!(
            authorize(&project, &manifest),
            Err(Error::Forbidden)
        ));
    }
}
