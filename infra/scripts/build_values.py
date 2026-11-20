"""Validate the nonsecret cloud build group before publishing release inputs."""

import ipaddress
import re


def valid_destination(value):
    """Match the runtime's strict IP parser and ipnet's decimal CIDR grammar."""
    destination = value.strip()
    if "%" in destination:
        raise ValueError("IPv6 zones are not IP addresses")
    parts = destination.split("/")
    address_text = parts[0]
    if len(parts) == 2 and "." in address_text:
        head, separator, octets_text = address_text.rpartition(":")
        if not re.fullmatch(r"[0-9]{1,3}(?:[.][0-9]{1,3}){3}", octets_text):
            raise ValueError("CIDR octets require one through three decimal digits")
        octets = [int(octet) for octet in octets_text.split(".")]
        if any(octet > 255 for octet in octets):
            raise ValueError("CIDR octets must fit an IPv4 address")
        address_text = head + separator + ".".join(str(octet) for octet in octets)
    address = ipaddress.ip_address(address_text)
    if len(parts) > 1:
        digits, maximum = (2, 32) if address.version == 4 else (3, 128)
        if (len(parts) != 2 or not re.fullmatch(r"[0-9]{1," + str(digits) + r"}", parts[1])
                or int(parts[1]) > maximum):
            raise ValueError("CIDR requires a bounded decimal prefix length")


def builds_config(config):
    if config is None:
        return {"enabled": False}
    required = {"enabled", "template", "deploymentId"}
    allowed = required | {"deniedDestinations", "perProcess"}
    if (not isinstance(config, dict) or set(config) - allowed
            or type(config.get("enabled")) is not bool):
        raise ValueError("Builds config accepts enabled, template, deploymentId, deniedDestinations and perProcess")
    if not config["enabled"]:
        if set(config) != {"enabled"}:
            raise ValueError("Disabled builds config contains no build settings")
        return config
    if not required <= set(config):
        raise ValueError("Enabled builds config requires template and deploymentId")
    template = config["template"]
    if not isinstance(template, str) or not template or template.strip() != template:
        raise ValueError("Build template requires a nonempty value without surrounding whitespace")
    deployment = config["deploymentId"]
    if not isinstance(deployment, str) or not re.fullmatch(r"[a-z0-9-]{1,63}", deployment):
        raise ValueError("Build deploymentId requires 1–63 lowercase letters, digits or hyphens")
    ceiling = config.get("perProcess", 4)
    if type(ceiling) is not int or not 1 <= ceiling <= 16:
        raise ValueError("Build perProcess requires an integer from 1 through 16")
    if "deniedDestinations" in config:
        destinations = config["deniedDestinations"]
        if not isinstance(destinations, list) or len(destinations) > 32:
            raise ValueError("Build deniedDestinations requires at most 32 IPs or CIDRs")
        for value in destinations:
            if not isinstance(value, str):
                raise ValueError("Build deniedDestinations accepts only IPs or CIDRs")
            try:
                valid_destination(value)
            except ValueError as error:
                raise ValueError("Build deniedDestinations accepts only IPs or CIDRs") from error
    return config
