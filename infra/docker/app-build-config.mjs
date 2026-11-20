import process from "node:process";

const config = {};
for (const kind of ["api", "app"]) {
  const name = `EXPO_PUBLIC_MKC_${kind.toUpperCase()}_ORIGIN`;
  const value = process.env[name];
  const url = new URL(value);
  if (
    url.origin !== value ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  ) {
    throw new Error(`Supply an exact HTTPS origin for ${name}`);
  }
  config[`${kind}Origin`] = value;
}
const catalogueBaseDomain = process.env.MKC_CATALOGUE_BASE_DOMAIN ?? "";
if (
  !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
    catalogueBaseDomain,
  )
) {
  throw new Error("Supply MKC_CATALOGUE_BASE_DOMAIN as a lowercase DNS name");
}
config.catalogueBaseDomain = catalogueBaseDomain;
if (!/^[a-f0-9]{40}$/.test(process.env.MKC_BUILD_SHA ?? "")) {
  throw new Error("Supply MKC_BUILD_SHA as a full Git revision");
}
config.revision = process.env.MKC_BUILD_SHA;
process.stdout.write(`${JSON.stringify(config)}\n`);
