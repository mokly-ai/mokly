//! Credentialed candidate verification enabled only by the operator feature.

use std::env;

use mkc_api::build_providers::{BuildProviderFactory, SystemBuildProviderFactory};
use mkc_config::builds::BuildSettings;

use super::fixtures::request;
use super::probe::{ProbeError, StreamTemplateProbe, TemplateProbe};

#[tokio::test]
async fn live_template() -> Result<(), ProbeError> {
    let Ok(api_key) = env::var("MKC_E2B_API_KEY") else {
        return Err(ProbeError::MissingApiKey);
    };
    let Ok(template) = env::var("MKC_E2B_BUILD_TEMPLATE") else {
        return Err(ProbeError::MissingTemplate);
    };
    let factory: &dyn BuildProviderFactory = &SystemBuildProviderFactory;
    let Ok(providers) = factory.create(&BuildSettings {
        api_key,
        template,
        deployment_id: "mokly-build-template-probe".into(),
        denied_destinations: Vec::new(),
        per_process: 1,
    }) else {
        return Err(ProbeError::Configuration);
    };
    let probe: &dyn TemplateProbe = &StreamTemplateProbe {
        sandbox: providers.sandbox,
    };
    probe.run(request()).await?;
    println!("PASS live build template: assertion completed and candidate destroyed");
    Ok(())
}
