//! Shared secret and repository-local environment names excluded from xtask children.

/// Secret variables that subprocess builders must explicitly remove.
pub(crate) const SECRET_VARIABLES: &[&str] = &["BLACKSMITH_ORG_TOKEN"];

/// Repository-local names from `git rev-parse --local-env-vars` in Git 2.50.1.
pub(crate) const GIT_REPOSITORY_VARIABLES: &[&str] = &[
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_CONFIG",
    "GIT_CONFIG_PARAMETERS",
    "GIT_CONFIG_COUNT",
    "GIT_OBJECT_DIRECTORY",
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_IMPLICIT_WORK_TREE",
    "GIT_GRAFT_FILE",
    "GIT_INDEX_FILE",
    "GIT_NO_REPLACE_OBJECTS",
    "GIT_REPLACE_REF_BASE",
    "GIT_PREFIX",
    "GIT_SHALLOW_FILE",
    "GIT_COMMON_DIR",
];
