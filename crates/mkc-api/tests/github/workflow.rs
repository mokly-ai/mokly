//! Browser OAuth, installation binding and project creation through public routes.

use mkc_auth::runtime::hash;
use mkc_domain::ids::{InstallationId, ProjectId, RepositoryId};
use reqwest::Method;
use serde_json::{Value, json};

use super::harness::{Harness, json as response_json};

const RETURN_TO: &str = "/mokly/cloud?selection=one%26two&tag=alpha%2Bbeta&note=release%23one&branch=équipe/東京&view=changes&view=browse";

pub(super) struct Project {
    pub(super) id: ProjectId,
    pub(super) repository: RepositoryId,
    pub(super) installation: InstallationId,
}

impl Harness {
    pub(super) fn sign_in(&mut self) {
        let start = response_json(
            self.request(Method::POST, "/v1/auth/github")
                .json(&json!({"returnTo":RETURN_TO}))
                .send()
                .unwrap(),
            200,
        );
        assert_eq!(start["state"].as_str().unwrap().len(), 64);
        assert_ne!(start["state"], start["codeVerifier"]);
        assert!(
            start["authorizeUrl"]
                .as_str()
                .unwrap()
                .contains("code_challenge_method=S256")
        );
        let state = start["state"].as_str().unwrap().to_owned();
        self.queries(&mut |queries| {
            let flow = queries.github_oauth_flow(&hash(&state))?.unwrap();
            assert_eq!(flow.return_to, RETURN_TO);
            Ok(())
        });
        let callback = json!({"code":"fixture-code","state":start["state"],"codeVerifier":start["codeVerifier"]});
        let response = self
            .request(Method::POST, "/v1/auth/github/callback")
            .json(&callback)
            .send()
            .unwrap();
        let body = self.session(response);
        assert_eq!(body["session"]["user"]["id"], self.user.to_string());
        assert_eq!(body["session"]["user"]["name"], "Existing email account");
        assert_eq!(body["session"]["user"]["githubConnected"], true);
        assert_eq!(body["returnTo"], RETURN_TO);
        let replay = response_json(
            self.request(Method::POST, "/v1/auth/github/callback")
                .json(&callback)
                .send()
                .unwrap(),
            400,
        );
        assert_eq!(replay["error"]["reason"], "github-auth-invalid");
        assert_eq!(self.github.mode.lock().unwrap().oauth_requests, 1);
    }

    pub(super) fn workspace(&self, name: &str) -> Value {
        let slug = name.to_ascii_lowercase().replace(' ', "-");
        response_json(
            self.request(Method::POST, "/v1/workspaces")
                .json(&json!({"name":name,"slug":slug}))
                .send()
                .unwrap(),
            201,
        )
    }

    pub(super) fn install_project(&mut self) -> Project {
        let workspace = self.workspace("Recorded GitHub team");
        let start = response_json(
            self.request(Method::POST, "/v1/github/installations")
                .json(&json!({"workspaceId":workspace["id"],"returnTo":"/install"}))
                .send()
                .unwrap(),
            200,
        );
        assert!(
            start["authorizeUrl"]
                .as_str()
                .unwrap()
                .starts_with(&format!(
                    "{}/apps/mokly-test/installations/new?",
                    self.github.origin
                ))
        );
        let setup = response_json(self.request(Method::POST, "/v1/github/installations/callback")
            .json(&json!({"installationId":1,"state":start["state"],"codeVerifier":start["codeVerifier"]})).send().unwrap(), 200);
        assert_eq!(setup["state"], start["state"]);
        let previous = self.cookie.clone();
        let response = self.request(Method::POST, "/v1/auth/github/callback")
            .json(&json!({"code":"installation-proof","state":start["state"],"codeVerifier":start["codeVerifier"]})).send().unwrap();
        let session = self.session(response);
        assert_eq!(session["returnTo"], "/install");
        assert_ne!(previous, self.cookie);
        let list = response_json(
            self.request(Method::GET, "/v1/github/installations")
                .send()
                .unwrap(),
            200,
        );
        assert_eq!(list["items"].as_array().unwrap().len(), 1);
        let installation: InstallationId = list["items"][0]["id"]
            .as_str()
            .unwrap()
            .parse::<uuid::Uuid>()
            .unwrap()
            .into();
        let repositories = response_json(
            self.request(
                Method::GET,
                &format!("/v1/github/installations/{installation}/repositories"),
            )
            .send()
            .unwrap(),
            200,
        );
        let repository = &repositories["items"][0];
        assert_eq!(repository["fullName"], "octocat/Hello-World");
        let input = json!({"name":"Fixture catalogue","slug":"fixture-catalogue","repositoryId":repository["id"],"configPath":"mokly.config.json"});
        let path = format!(
            "/v1/workspaces/{}/projects",
            workspace["id"].as_str().unwrap()
        );
        let project = response_json(
            self.request(Method::POST, &path)
                .json(&input)
                .send()
                .unwrap(),
            201,
        );
        assert_eq!(project["repository"], "octocat/Hello-World");
        let duplicate = response_json(
            self.request(Method::POST, &path)
                .json(&input)
                .send()
                .unwrap(),
            409,
        );
        assert_eq!(duplicate["error"]["reason"], "duplicate-project");
        let other = self.workspace("Other workspace");
        let denied = response_json(
            self.request(
                Method::POST,
                &format!("/v1/workspaces/{}/projects", other["id"].as_str().unwrap()),
            )
            .json(&input)
            .send()
            .unwrap(),
            404,
        );
        assert_eq!(denied["error"]["reason"], "not-found");
        Project {
            id: project["id"]
                .as_str()
                .unwrap()
                .parse::<uuid::Uuid>()
                .unwrap()
                .into(),
            repository: repository["id"]
                .as_str()
                .unwrap()
                .parse::<uuid::Uuid>()
                .unwrap()
                .into(),
            installation,
        }
    }
}
