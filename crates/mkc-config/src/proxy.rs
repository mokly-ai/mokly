//! Explicit proxy trust and pure client-address selection.

use std::net::IpAddr;

use ipnet::IpNet;

use crate::settings::{EnvironmentConfig, Error, Result};

/// A bounded path through explicitly trusted proxy networks.
#[derive(Clone, Debug, Default)]
pub struct TrustedProxies {
    /// Number of forwarded entries to walk backwards from the socket peer.
    pub hops: u8,
    /// Permitted peer and intermediary networks, never candidate client networks.
    pub networks: Vec<IpNet>,
}

impl TrustedProxies {
    /// Return the original peer unless the entire configured path is trusted.
    pub fn client_ip(&self, peer: IpAddr, forwarded: Option<&str>) -> IpAddr {
        if self.hops == 0 {
            return peer;
        }
        let Some(forwarded) = forwarded.filter(|value| value.len() <= 4096) else {
            return peer;
        };
        let mut addresses = Vec::new();
        for value in forwarded.split(',') {
            let Ok(address) = value.trim().parse::<IpAddr>() else {
                return peer;
            };
            addresses.push(address);
        }
        if addresses.len() < usize::from(self.hops) {
            return peer;
        }
        let mut current = peer;
        for address in addresses.iter().rev().take(usize::from(self.hops)) {
            if !self
                .networks
                .iter()
                .any(|network| network.contains(&current))
            {
                return peer;
            }
            current = *address;
        }
        current
    }
}

/// Startup validation of the trusted proxy boundary.
pub trait ProxyConfig {
    /// Load a disabled-by-default policy; positive hops require an allowlist.
    fn proxies(&self) -> Result<TrustedProxies>;
}

impl ProxyConfig for EnvironmentConfig {
    fn proxies(&self) -> Result<TrustedProxies> {
        let hops = match self.environment.get("MKC_TRUSTED_PROXY_HOPS") {
            None => 0,
            Some(value) => match value.parse::<u8>() {
                Ok(hops) if hops <= 16 => hops,
                _ => return Err(Error::Invalid("MKC_TRUSTED_PROXY_HOPS")),
            },
        };
        let mut networks = Vec::new();
        if let Some(value) = self.environment.get("MKC_TRUSTED_PROXY_CIDRS") {
            for network in value.split(',') {
                match network.trim().parse() {
                    Ok(network) => networks.push(network),
                    Err(_) => return Err(Error::Invalid("MKC_TRUSTED_PROXY_CIDRS")),
                }
            }
        }
        if hops > 0 && networks.is_empty() {
            return Err(Error::Invalid("MKC_TRUSTED_PROXY_CIDRS"));
        }
        Ok(TrustedProxies { hops, networks })
    }
}

#[cfg(test)]
#[path = "_tests_/proxy_tests.rs"]
mod tests;
