# Changelog

## [0.23.0](https://github.com/mokly-ai/mokly/compare/v0.22.0...v0.23.0) (2026-11-28)


### Features

* **cloud:** make each list row one link or button over the whole row ([#600](https://github.com/mokly-ai/mokly/issues/600)) ([201b2c3](https://github.com/mokly-ai/mokly/commit/201b2c3eb9486e431fff4c3829eee63c5b682c1e))


### Bug Fixes

* **desktop:** show Check for updates in a Help menu on every platform ([#604](https://github.com/mokly-ai/mokly/issues/604)) ([716a328](https://github.com/mokly-ai/mokly/commit/716a3285e47ff1e84a6b5d5f86c9f627237af92d))
* **frame:** name preview pages that an earlier Mokly built ([#602](https://github.com/mokly-ai/mokly/issues/602)) ([dc1c617](https://github.com/mokly-ai/mokly/commit/dc1c617cc8080a098867f0644788b8d41d65c2fa))

## [0.22.0](https://github.com/mokly-ai/mokly/compare/v0.21.0...v0.22.0) (2026-11-27)


### ⚠ BREAKING CHANGES

* redesign the site, the viewer and the cloud chrome in Canvas ([#488](https://github.com/mokly-ai/mokly/issues/488))

### Features

* **app:** draw the publication pill as one Button with a content node ([6d4f4f6](https://github.com/mokly-ai/mokly/commit/6d4f4f6cf5e2ed8c54fdf5aa9637f1abddad0e1f))
* **build-template:** start the template from Debian and release v8 ([#588](https://github.com/mokly-ai/mokly/issues/588)) ([215f094](https://github.com/mokly-ai/mokly/commit/215f094f96273272763d081fb541590e159ec653))
* **config:** add moduleResolution.sourcePackages and ignored-module ([#596](https://github.com/mokly-ai/mokly/issues/596)) ([c345aa0](https://github.com/mokly-ai/mokly/commit/c345aa04ad76c0dcfd15e3fe437ff1a3b28c9796))
* **desktop:** publish each release as the latest full release ([#496](https://github.com/mokly-ai/mokly/issues/496)) ([10a30af](https://github.com/mokly-ai/mokly/commit/10a30afe44f064aef406526c5a5f11640ee367b5))
* **desktop:** put the Mac window buttons in the app's top bar ([#397](https://github.com/mokly-ai/mokly/issues/397)) ([1a5d2b2](https://github.com/mokly-ai/mokly/commit/1a5d2b2418b82556afebdaaf35e8506e6c04c79f))
* **desktop:** release from a release pull request with safe Mac updates ([#423](https://github.com/mokly-ai/mokly/issues/423)) ([e75947e](https://github.com/mokly-ai/mokly/commit/e75947e27e580ac7b840f95a65f059d812b36810))
* **mockups:** name the Desktop viewport in the drawn Share link ([6d4f4f6](https://github.com/mokly-ai/mokly/commit/6d4f4f6cf5e2ed8c54fdf5aa9637f1abddad0e1f))
* **preview:** sign in to PR previews with a shared preview password ([#563](https://github.com/mokly-ai/mokly/issues/563)) ([895ad2d](https://github.com/mokly-ai/mokly/commit/895ad2d1c60a67118deccdaacc613711261640b2))
* redesign the site, the viewer and the cloud chrome in Canvas ([#488](https://github.com/mokly-ai/mokly/issues/488)) ([6d4f4f6](https://github.com/mokly-ai/mokly/commit/6d4f4f6cf5e2ed8c54fdf5aa9637f1abddad0e1f))
* **sidecar:** load workspace package sources in base renders ([#501](https://github.com/mokly-ai/mokly/issues/501)) ([8976079](https://github.com/mokly-ai/mokly/commit/89760791f5881d19e0abb7b11f99b838b10ba789))
* **site:** send Get started to sign-up and label the CLI action Docs ([#500](https://github.com/mokly-ai/mokly/issues/500)) ([f12243f](https://github.com/mokly-ai/mokly/commit/f12243f4cc30a7dd73309acbd6c17d973acad707))
* **ui:** add the Swipe mode, the Swipe divider and the side tag of a frame ([6d4f4f6](https://github.com/mokly-ai/mokly/commit/6d4f4f6cf5e2ed8c54fdf5aa9637f1abddad0e1f))
* **viewer:** add the data and keys of the Changes tab ([6d4f4f6](https://github.com/mokly-ai/mokly/commit/6d4f4f6cf5e2ed8c54fdf5aa9637f1abddad0e1f))


### Bug Fixes

* **app:** keep the viewer mounted when a panel closes ([#522](https://github.com/mokly-ai/mokly/issues/522)) ([5a9f080](https://github.com/mokly-ai/mokly/commit/5a9f08007323a70332b9b664eeffbdd57e11e6c6))
* **app:** keep the waiting account placeholder a window drag area ([618153c](https://github.com/mokly-ai/mokly/commit/618153c0611a39f2dcd35cd4bc40b5bcf093ec2f))
* **app:** let the avatar open the account menu in the Mac app ([#514](https://github.com/mokly-ai/mokly/issues/514)) ([618153c](https://github.com/mokly-ai/mokly/commit/618153c0611a39f2dcd35cd4bc40b5bcf093ec2f))
* apply the flaky-test decisions of 2026-11-26 ([#552](https://github.com/mokly-ai/mokly/issues/552)) ([4d48e98](https://github.com/mokly-ai/mokly/commit/4d48e981059442f16fb7dac2d5823519438212c5))
* **build-template:** give the template Git 2.56.1 and probe Git 2.43 ([#568](https://github.com/mokly-ai/mokly/issues/568)) ([1ce3ed0](https://github.com/mokly-ai/mokly/commit/1ce3ed0beba4732210dc715ea723f65fcfc2cfdc))
* **build-template:** keep the base toolchain and give Git PCRE2 (v6) ([#571](https://github.com/mokly-ai/mokly/issues/571)) ([c9b6697](https://github.com/mokly-ai/mokly/commit/c9b66976f148d664bc6df64728be6c97d1b1e4ac))
* **build-template:** remove the base image's npm and release v3 ([#554](https://github.com/mokly-ai/mokly/issues/554)) ([b5bcb1b](https://github.com/mokly-ai/mokly/commit/b5bcb1ba4efdecaeaad310c19d52a322649701a8))
* **ci:** flaky viewer readiness test sees a late hover ([#507](https://github.com/mokly-ai/mokly/issues/507)) ([894f5f4](https://github.com/mokly-ai/mokly/commit/894f5f4ddec7a1da56908e30bf34c6357560c2bf))
* **cloud-builds:** pin the E2B adapter whose one-shot create E2B accepts ([#510](https://github.com/mokly-ai/mokly/issues/510)) ([6fbcfa8](https://github.com/mokly-ai/mokly/commit/6fbcfa806a9e070bc94250c82de19379de4987b1))
* **mkc-publications:** log why a build attempt ends as infrastructure ([#532](https://github.com/mokly-ai/mokly/issues/532)) ([1f2f000](https://github.com/mokly-ai/mokly/commit/1f2f00024091ccbde101cbb0af9c3ca4413672b9))
* **platform:** a process reaped during a Linux tree walk is gone ([86f6755](https://github.com/mokly-ai/mokly/commit/86f675549e89abecae6f68f3b167f709cb88e712))
* **platform:** keep the root unreaped until tree cleanup ends ([#557](https://github.com/mokly-ai/mokly/issues/557)) ([63f827c](https://github.com/mokly-ai/mokly/commit/63f827c2be012263d07d4f247cfb1cb26cfc1ca6))
* **postcss:** refresh stylesheets after observed config edits ([#462](https://github.com/mokly-ai/mokly/issues/462)) ([134d1c0](https://github.com/mokly-ai/mokly/commit/134d1c04b8951804c0f0caf62a1fab319a5f4a06))
* **render:** a cancelled render store operation is not a store fault ([86f6755](https://github.com/mokly-ai/mokly/commit/86f675549e89abecae6f68f3b167f709cb88e712))
* **render:** preserve store hits during index maintenance ([#456](https://github.com/mokly-ai/mokly/issues/456)) ([85af99d](https://github.com/mokly-ai/mokly/commit/85af99d752d81376d9802dcf878be13b2fd86ee7))
* **serve:** keep queued background renders in request order ([#447](https://github.com/mokly-ai/mokly/issues/447)) ([783d791](https://github.com/mokly-ai/mokly/commit/783d7919b9e3c12564b4eff9fdd5c1449adee7cd))
* **sidecar:** start a prepared PostCSS child only from prepareContext ([#475](https://github.com/mokly-ai/mokly/issues/475)) ([a2ae563](https://github.com/mokly-ai/mokly/commit/a2ae5636010353d9ed2cdf1c037805b6bb5b5dd6))
* **site:** start the Copy and search islands on a page that never goes idle ([398cf4c](https://github.com/mokly-ai/mokly/commit/398cf4c2576f87394f278d09920a4e0a1e555b7c))
* **test:** apply the decisions on the open flaky-test items ([#558](https://github.com/mokly-ai/mokly/issues/558)) ([a006e6a](https://github.com/mokly-ai/mokly/commit/a006e6a99e5ec9570f5d12e0092a146b14167657))
* **test:** fix root causes of flaky follow-ups B and new CI flakes ([#550](https://github.com/mokly-ai/mokly/issues/550)) ([c964390](https://github.com/mokly-ai/mokly/commit/c9643901fab931ff040be62ba23117b7ea34d71d))
* **test:** fix root causes of flaky viewer and browser tests ([#526](https://github.com/mokly-ai/mokly/issues/526)) ([bde3f11](https://github.com/mokly-ai/mokly/commit/bde3f11a16e7fb28e17343510742328bde79faaf))
* **test:** keep owner closing markers and record manager exit status ([#559](https://github.com/mokly-ai/mokly/issues/559)) ([af0032a](https://github.com/mokly-ai/mokly/commit/af0032aa9283cc4c02090d6ee001e313ce49ac34))
* **test:** remove the races of the render writer and hang clock tests ([#543](https://github.com/mokly-ai/mokly/issues/543)) ([b343edf](https://github.com/mokly-ai/mokly/commit/b343edfbc0c9d5874d0a627bc898e9644b5601d5))
* **test:** remove the root causes of eight flaky Rust tests ([#523](https://github.com/mokly-ai/mokly/issues/523)) ([86f6755](https://github.com/mokly-ai/mokly/commit/86f675549e89abecae6f68f3b167f709cb88e712))
* **test:** remove the sources of three flaky cloud tests ([#521](https://github.com/mokly-ai/mokly/issues/521)) ([398cf4c](https://github.com/mokly-ai/mokly/commit/398cf4c2576f87394f278d09920a4e0a1e555b7c))
* **test:** resolve the published CLI install as of its release ([398cf4c](https://github.com/mokly-ai/mokly/commit/398cf4c2576f87394f278d09920a4e0a1e555b7c))
* **test:** wait for the way back before pressing it ([398cf4c](https://github.com/mokly-ai/mokly/commit/398cf4c2576f87394f278d09920a4e0a1e555b7c))
* **viewer:** hold each version of Side by side in its version's layer ([6d4f4f6](https://github.com/mokly-ai/mokly/commit/6d4f4f6cf5e2ed8c54fdf5aa9637f1abddad0e1f))


### Performance Improvements

* **changes:** integrate miss-first base capture with render store ([#452](https://github.com/mokly-ai/mokly/issues/452)) ([77021d8](https://github.com/mokly-ai/mokly/commit/77021d88cf483f56943b7ebaea462ca787c29951))
* **cli:** shorten mimalloc's purge delay after Serve's first Changes ([#482](https://github.com/mokly-ai/mokly/issues/482)) ([9639d0a](https://github.com/mokly-ai/mokly/commit/9639d0a5cf21472fea3bdcca40cd796f2d343ed3))
* **dev:** skip unchanged builds and unused fixtures in local runs ([#536](https://github.com/mokly-ai/mokly/issues/536)) ([84d9f85](https://github.com/mokly-ai/mokly/commit/84d9f85ca890efd4d6adbd16749362009bc2edc1))
* **graph:** reuse unchanged render keys after Serve edits ([#455](https://github.com/mokly-ai/mokly/issues/455)) ([6c203b9](https://github.com/mokly-ai/mokly/commit/6c203b9154a3ea8169b9eda31612ed26e707a30c))
* **render:** batch base module lookups and optimise hash crates ([#553](https://github.com/mokly-ai/mokly/issues/553)) ([429d04c](https://github.com/mokly-ai/mokly/commit/429d04c4d18ee6715d5c7bed4eb155d9db54ba26))
* **render:** compile independent startup class-map stylesheets in parallel ([#451](https://github.com/mokly-ai/mokly/issues/451)) ([8ce9a1e](https://github.com/mokly-ai/mokly/commit/8ce9a1ee8250cb42ded55fdf463997f93b4129e3))
* **render:** prepare PostCSS during Serve startup ([#464](https://github.com/mokly-ai/mokly/issues/464)) ([d596e4a](https://github.com/mokly-ai/mokly/commit/d596e4aa3a0fa86f30a768996f1347ed82e22249))
* **serve:** compress JSON and revalidate resources at stable URLs ([#485](https://github.com/mokly-ai/mokly/issues/485)) ([720b1f8](https://github.com/mokly-ai/mokly/commit/720b1f85b6176f7ce31611d97ebc13aa23b4228a))
* **serve:** keep sidecars busy during the head usage pass ([#408](https://github.com/mokly-ai/mokly/issues/408)) ([cb233fb](https://github.com/mokly-ai/mokly/commit/cb233fb50af71725ed464bfb1df08ab5463c5280))
* **serve:** overlap base preparation with head usage ([#461](https://github.com/mokly-ai/mokly/issues/461)) ([87e8984](https://github.com/mokly-ai/mokly/commit/87e8984cf3a5ae140f02066ea5ccb9473caa0808))
* **serve:** overlap fresh PostCSS setup with bundling ([#459](https://github.com/mokly-ai/mokly/issues/459)) ([793d0c7](https://github.com/mokly-ai/mokly/commit/793d0c77d1b096eb988e681963be4bca7a8df353))
* **serve:** prepare the PostCSS context of Serve base attempts ([#479](https://github.com/mokly-ai/mokly/issues/479)) ([3362e25](https://github.com/mokly-ai/mokly/commit/3362e250d0da1d5d60b0ac968628e6e473c05507))
* **serve:** reuse plans across editor file additions ([#450](https://github.com/mokly-ai/mokly/issues/450)) ([45a5f33](https://github.com/mokly-ai/mokly/commit/45a5f33e3d106ae8c4faa5802d039f3d6f7d3203))
* **serve:** reuse proven head validation facts ([#466](https://github.com/mokly-ai/mokly/issues/466)) ([27ffad4](https://github.com/mokly-ai/mokly/commit/27ffad4b2367d65a894a03cf037344b3833db8a9))
* **serve:** shorten the serial work after each edit ([#472](https://github.com/mokly-ai/mokly/issues/472)) ([cb8067b](https://github.com/mokly-ai/mokly/commit/cb8067bb2cddaa628892cd2bcd2989c8d2133cb0))
* **serve:** shorten the warm edit bundle ([#469](https://github.com/mokly-ai/mokly/issues/469)) ([765ffa5](https://github.com/mokly-ai/mokly/commit/765ffa5560acc9089a23dfbf9a7c4e30f78c8694))
* **sidecar:** cache parsed export names across generations ([#468](https://github.com/mokly-ai/mokly/issues/468)) ([6f952f4](https://github.com/mokly-ai/mokly/commit/6f952f42f5dd6fdad507f2ec2d8578d287226cf6))
* **sidecar:** index the style registry of each generation ([#487](https://github.com/mokly-ai/mokly/issues/487)) ([551d378](https://github.com/mokly-ai/mokly/commit/551d378db2b5ae73793ae7562f69852d20b61c57))
* **sidecar:** keep one esbuild context for guarded edit compiles ([#478](https://github.com/mokly-ai/mokly/issues/478)) ([c699b35](https://github.com/mokly-ai/mokly/commit/c699b35d3365a2db600263747537e09f9766e184))
* **sidecar:** reduce bundle reuse read overhead ([#449](https://github.com/mokly-ai/mokly/issues/449)) ([e331ad6](https://github.com/mokly-ai/mokly/commit/e331ad64bb684b0c6049ef6b0a7ec92af44f4dde))
* **sidecar:** resolve safe relative imports in esbuild during planned edit compiles ([#448](https://github.com/mokly-ai/mokly/issues/448)) ([e69db4c](https://github.com/mokly-ai/mokly/commit/e69db4ce847412d5807cff4f7d56c3bc705704a5))
* **sidecar:** return references for restored bundle reuse ([#465](https://github.com/mokly-ai/mokly/issues/465)) ([249fa1a](https://github.com/mokly-ai/mokly/commit/249fa1aa5f5fb1ffab7dd9e3d5bd589f0019e38a))
* **sidecar:** shorten bundle response work ([#463](https://github.com/mokly-ai/mokly/issues/463)) ([3771114](https://github.com/mokly-ai/mokly/commit/377111494bdaa6955f90233190a64acdbf4f6963))
* **sidecar:** skip repeated work in the plan-candidate collector ([#481](https://github.com/mokly-ai/mokly/issues/481)) ([439c6bb](https://github.com/mokly-ai/mokly/commit/439c6bb9920cd6bfc751976e8c4a44f9d7352a9f))
* **sidecar:** start the PostCSS child before the bundle cache read ([#470](https://github.com/mokly-ai/mokly/issues/470)) ([1a2534d](https://github.com/mokly-ai/mokly/commit/1a2534d03e0764809ef3386bcfbfcceee47cabd3))
* **viewer:** reuse unchanged data across Serve publications ([#483](https://github.com/mokly-ai/mokly/issues/483)) ([10800ce](https://github.com/mokly-ai/mokly/commit/10800cee95451b4da6a584dbef7756cd3cbbfd31))

## [0.21.0](https://github.com/mokly-ai/mokly/compare/v0.20.0...v0.21.0) (2026-11-20)


### Features

* **viewer:** hide removed entries from the All filter ([#417](https://github.com/mokly-ai/mokly/issues/417)) ([098d108](https://github.com/mokly-ai/mokly/commit/098d1080aa305eb92ab7fd891191c021de464f55))


### Bug Fixes

* **viewer:** wait for slow previews and recover focus after Try again ([#428](https://github.com/mokly-ai/mokly/issues/428)) ([3e09c61](https://github.com/mokly-ai/mokly/commit/3e09c6150e076abb0caead6fa2af8500087aece9))

## [0.20.0](https://github.com/mokly-ai/mokly/compare/v0.19.0...v0.20.0) (2026-11-20)


### Features

* **cache:** reuse compiled bundles across command processes ([#312](https://github.com/mokly-ai/mokly/issues/312)) ([e60c165](https://github.com/mokly-ai/mokly/commit/e60c165320bbe8c6f6afef6183ccf4bab496e9e5))
* combine Mokly Cloud into the Mokly repository ([#350](https://github.com/mokly-ai/mokly/issues/350)) ([5cba4dc](https://github.com/mokly-ai/mokly/commit/5cba4dc4b9c8f37a1accca72a89263ab25cf05cd))
* **desktop:** open Stripe pages in the system browser ([#405](https://github.com/mokly-ai/mokly/issues/405)) ([9ef0cde](https://github.com/mokly-ai/mokly/commit/9ef0cdec7f9b2859f181562baed3254dc4969cf5))
* **ui:** use neutral Graphite greys for the dark theme ([#299](https://github.com/mokly-ai/mokly/issues/299)) ([d83859b](https://github.com/mokly-ai/mokly/commit/d83859b90e5c8eb72365d4cf45910152461a59bd))


### Bug Fixes

* **api:** name build dead letters in check status help ([#393](https://github.com/mokly-ai/mokly/issues/393)) ([e5acd1a](https://github.com/mokly-ai/mokly/commit/e5acd1a25355139eeaa4559b3fed0ade35afabee))
* **app:** apply only the newest session read ([#377](https://github.com/mokly-ai/mokly/issues/377)) ([525b4d7](https://github.com/mokly-ai/mokly/commit/525b4d7e505c1ebc7a3c18cd6f2a58bcd3630b2d))
* **app:** preserve Checkout query while settings routes wait ([#388](https://github.com/mokly-ai/mokly/issues/388)) ([904d1a3](https://github.com/mokly-ai/mokly/commit/904d1a3e93d1d08b289764a67540ba24450a8aac))
* **app:** preserve GitHub flows after late answers ([#390](https://github.com/mokly-ai/mokly/issues/390)) ([3bf6e3c](https://github.com/mokly-ai/mokly/commit/3bf6e3c9a965c434a757f552d0a1fcb7b3f4eda8))
* **auth:** bound prune deletes by batch and deadline ([#389](https://github.com/mokly-ai/mokly/issues/389)) ([be8a41a](https://github.com/mokly-ai/mokly/commit/be8a41a9cfc21ed1aeae1bd201614befde42aa73))
* **catalogue:** one containment rule for a linked repository root ([#365](https://github.com/mokly-ai/mokly/issues/365)) ([ea5a7ef](https://github.com/mokly-ai/mokly/commit/ea5a7ef3d16d2e627cd71d8eee23b8130204065d))
* **catalogue:** preserve chunk origins after empty end tags ([#391](https://github.com/mokly-ai/mokly/issues/391)) ([e272615](https://github.com/mokly-ai/mokly/commit/e272615f206e31c85bb435fae78c60f93cd178f4))
* **cli:** install the latest release on every Node version ([#298](https://github.com/mokly-ai/mokly/issues/298)) ([f380e94](https://github.com/mokly-ai/mokly/commit/f380e94622413abb00c6d515fbb8a723c83f4e7d))
* **cli:** print base diagnostic location lists on following lines ([#374](https://github.com/mokly-ai/mokly/issues/374)) ([162b797](https://github.com/mokly-ai/mokly/commit/162b7974a1412a8f6d7128c11f1a677be936bd83))
* **cli:** print the full scripts recovery hint in rich errors ([#364](https://github.com/mokly-ai/mokly/issues/364)) ([38e574a](https://github.com/mokly-ai/mokly/commit/38e574a1938591a37e1c6a5bc57eec355b773336))
* **compare:** bound install cleanup after the final stop signal ([#358](https://github.com/mokly-ai/mokly/issues/358)) ([44eda16](https://github.com/mokly-ai/mokly/commit/44eda16b8d6374bdacad3fe9b8f53e4a5934c6e7))
* **config:** resolve configured renderer and PostCSS module paths once ([#338](https://github.com/mokly-ai/mokly/issues/338)) ([4614c4a](https://github.com/mokly-ai/mokly/commit/4614c4a90acb2e926269979508e652bd60a7ce9b))
* **git:** find missing base objects before reading sizes on every Git version ([#382](https://github.com/mokly-ai/mokly/issues/382)) ([91e3a45](https://github.com/mokly-ai/mokly/commit/91e3a454d33ad6ddfa42bdfcf92edf979790a979))
* **git:** own every process of tree reads in a partial clone ([#336](https://github.com/mokly-ai/mokly/issues/336)) ([e40ac84](https://github.com/mokly-ai/mokly/commit/e40ac84663bf34d257dcd27e499502fc6767e8a6))
* **infra:** link the alert runbooks in this repository ([5cba4dc](https://github.com/mokly-ai/mokly/commit/5cba4dc4b9c8f37a1accca72a89263ab25cf05cd))
* **model:** write related document references into catalogue output ([#333](https://github.com/mokly-ai/mokly/issues/333)) ([1496e47](https://github.com/mokly-ai/mokly/commit/1496e47bea2cef07b1d6836a2c64b1fffcdda3fc))
* **platform:** keep the call site of each platform I/O error ([#321](https://github.com/mokly-ai/mokly/issues/321)) ([159231c](https://github.com/mokly-ai/mokly/commit/159231c31909fd9ef5fd90d3a14ce64f6ac14d78))
* **render:** invalidate stylesheets when resolver inputs change ([#384](https://github.com/mokly-ai/mokly/issues/384)) ([940ddd7](https://github.com/mokly-ai/mokly/commit/940ddd7420520c0dbbb1ace89bc3803ddf50b740))
* **render:** keep a hash character in definition module paths ([#329](https://github.com/mokly-ai/mokly/issues/329)) ([c2d4148](https://github.com/mokly-ai/mokly/commit/c2d4148c7642fd2a4664b0ad7a0fdf6ccbe64a37))
* **sidecar:** bound default pool growth by available memory ([#330](https://github.com/mokly-ai/mokly/issues/330)) ([6238d46](https://github.com/mokly-ai/mokly/commit/6238d465cd29631f8371041f8ea94f96375098ac))
* **sidecar:** classify bundle reuse from actual compiles ([#404](https://github.com/mokly-ai/mokly/issues/404)) ([a16a623](https://github.com/mokly-ai/mokly/commit/a16a623e670deca5256ef6a43044f9441abad313))
* **sidecar:** invalidate reuse for earlier mapped import targets ([#343](https://github.com/mokly-ai/mokly/issues/343)) ([3063dd8](https://github.com/mokly-ai/mokly/commit/3063dd8d1d429d53ffe7378ab07f3bc61c8016b7))
* **sidecar:** record literal export targets in reuse evidence ([#409](https://github.com/mokly-ai/mokly/issues/409)) ([70a565d](https://github.com/mokly-ai/mokly/commit/70a565d46eee9e35dabbc5a63ef4cd3b3dc135d3))
* **sidecar:** stop the startup tree before reaping a partial start ([#406](https://github.com/mokly-ai/mokly/issues/406)) ([a1d87a3](https://github.com/mokly-ai/mokly/commit/a1d87a35656966bc5a09415a11e0895cff0b44b4))
* **ui:** size the preview note by its own text, not the host root font ([#373](https://github.com/mokly-ai/mokly/issues/373)) ([6995b84](https://github.com/mokly-ai/mokly/commit/6995b84b75465f090ef41c6c0ddb768381b7fde8))
* **viewer:** keep a working preview ready after an inspection error ([#331](https://github.com/mokly-ai/mokly/issues/331)) ([88b0147](https://github.com/mokly-ai/mokly/commit/88b014719ab47ccf73d09e18f3cb1594f5ba25cc))
* **viewer:** keep the search when a listed row shows the destination ([#306](https://github.com/mokly-ai/mokly/issues/306)) ([760a2c2](https://github.com/mokly-ai/mokly/commit/760a2c2941a706a451e7d010eed8ed7aed5404a6))
* **viewer:** route asynchronous document failures to the catalogue failure state ([#362](https://github.com/mokly-ai/mokly/issues/362)) ([c2fe4bf](https://github.com/mokly-ai/mokly/commit/c2fe4bf2a4043e315eb888b86542cb44ec93cce0))


### Performance Improvements

* **cache:** keep evicted documents compact in the render cache ([#291](https://github.com/mokly-ai/mokly/issues/291)) ([c42755b](https://github.com/mokly-ai/mokly/commit/c42755bcd71f3b157f96ed9ae84e39e38a3e3ec3))
* **cli:** use mimalloc for the binary's Rust allocations ([#297](https://github.com/mokly-ai/mokly/issues/297)) ([6d0fcbb](https://github.com/mokly-ai/mokly/commit/6d0fcbb462751459f1300e8e4de4ceeba5afbdd9))
* **compare:** memoize style scans and skip proven object checks ([#344](https://github.com/mokly-ai/mokly/issues/344)) ([3e62448](https://github.com/mokly-ai/mokly/commit/3e624480e5d68080b5188e1a097d0a43b74a6410))
* **compare:** overlap view preparation with ordered comparison ([#296](https://github.com/mokly-ai/mokly/issues/296)) ([86b7d57](https://github.com/mokly-ai/mokly/commit/86b7d576598e2d12b039e1693343ad7d1c7d6441))
* **compare:** read captured base usage without document restore ([#301](https://github.com/mokly-ai/mokly/issues/301)) ([ce654a9](https://github.com/mokly-ai/mokly/commit/ce654a90c0ad44a86166c195a40ea1236e23dda6))
* **compare:** skip duplicate work for equal documents ([#355](https://github.com/mokly-ai/mokly/issues/355)) ([9fb9ad1](https://github.com/mokly-ai/mokly/commit/9fb9ad1f9ac769db5a929555d57e8e0aecafb828))
* **css:** skip reference scans of text that cannot hold a reference ([#293](https://github.com/mokly-ai/mokly/issues/293)) ([331bf5d](https://github.com/mokly-ai/mokly/commit/331bf5d4386edebd8f224a96e557e3bd03fb9f77))
* **git:** shorten completion waits for Serve base checks ([#356](https://github.com/mokly-ai/mokly/issues/356)) ([6e011ca](https://github.com/mokly-ai/mokly/commit/6e011ca50a3a0e4f74973b19e20fdb9ccfefdcdc))
* **git:** start helper-free Git commands without forking the core ([#295](https://github.com/mokly-ai/mokly/issues/295)) ([0b82cf6](https://github.com/mokly-ai/mokly/commit/0b82cf6c0f6396d02db3a6066ed93e02f33183d6))
* **graph:** build render input keys without repeating shared work ([#294](https://github.com/mokly-ai/mokly/issues/294)) ([20e09f7](https://github.com/mokly-ai/mokly/commit/20e09f70a8ebd9aa4db5bb351e7dfa0cbd3c58b3))
* **graph:** calculate exporter render keys on render workers ([#303](https://github.com/mokly-ai/mokly/issues/303)) ([03bedb6](https://github.com/mokly-ai/mokly/commit/03bedb6ec19d0e51100e82507e00a5b05ecc5c5f))
* **graph:** restore compact documents from binary tree records ([#300](https://github.com/mokly-ai/mokly/issues/300)) ([794b30a](https://github.com/mokly-ai/mokly/commit/794b30a9182fba0ac0bed818f18535f4181cb88d))
* **graph:** share link checks within each generation ([#314](https://github.com/mokly-ai/mokly/issues/314)) ([bc858df](https://github.com/mokly-ai/mokly/commit/bc858df427b0ffe2cb53dbf3fe35a44e032475cc))
* **render:** end the stamp check at the first changed input ([#341](https://github.com/mokly-ai/mokly/issues/341)) ([7e81903](https://github.com/mokly-ai/mokly/commit/7e81903a817dc593260cb88b6c92e6f3ab9a20a7))
* **render:** reuse validated head stylesheets for the base ([#385](https://github.com/mokly-ai/mokly/issues/385)) ([c6d2fff](https://github.com/mokly-ai/mokly/commit/c6d2fffa4da42e7b5ff3d2999a301f7cb36e4120))
* **serve:** reuse captured resolution plans on edits ([#316](https://github.com/mokly-ai/mokly/issues/316)) ([be242a6](https://github.com/mokly-ai/mokly/commit/be242a628db21c24212b105c5a1f7277de2e8a29))
* **serve:** reuse proven view comparisons after edits ([#310](https://github.com/mokly-ai/mokly/issues/310)) ([f13a5d9](https://github.com/mokly-ai/mokly/commit/f13a5d9794a7d8531cb6a689d600f11df5797e8f))
* **serve:** reuse rendered documents after a restart ([#394](https://github.com/mokly-ai/mokly/issues/394)) ([104123b](https://github.com/mokly-ai/mokly/commit/104123bb7242877c6d719b15096ac9c330b5e882))
* **serve:** reuse the adopted watch plan when its inputs are equal ([#347](https://github.com/mokly-ai/mokly/issues/347)) ([6ae96ed](https://github.com/mokly-ai/mokly/commit/6ae96ed0852e20ec1b2f4b64a6b59cdac458e894))
* **serve:** reuse the kept base across Changes classifications ([#307](https://github.com/mokly-ai/mokly/issues/307)) ([b881bff](https://github.com/mokly-ai/mokly/commit/b881bfffb7a8b8bbb273792a0cdce0b750368a70))
* **server:** reuse equal detail publications across Serve phases ([#305](https://github.com/mokly-ai/mokly/issues/305)) ([f0c572b](https://github.com/mokly-ai/mokly/commit/f0c572b49a21ac6d6ff7ce21774ba1327bbfb0c5))
* **sidecar:** cut JavaScript work in each bundle call ([#319](https://github.com/mokly-ai/mokly/issues/319)) ([a44e401](https://github.com/mokly-ai/mokly/commit/a44e40119476ffadd1414a62855a0ce75aacc4e6))
* **sidecar:** keep head bundles on idle compiler processes ([#363](https://github.com/mokly-ai/mokly/issues/363)) ([3a9ca57](https://github.com/mokly-ai/mokly/commit/3a9ca57f37b5be004a68e8591926311f84ed059e))
* **sidecar:** keep head workers ready after base work ([#313](https://github.com/mokly-ai/mokly/issues/313)) ([24b238c](https://github.com/mokly-ai/mokly/commit/24b238ca400e949684267636fff39785ddded399))
* **sidecar:** prefer idle holders of the requested generation ([#315](https://github.com/mokly-ai/mokly/issues/315)) ([2e6bde9](https://github.com/mokly-ai/mokly/commit/2e6bde9c296e8bd12c16edeb2c23fbd2309b010b))
* **sidecar:** reduce work in each bundle compile ([#311](https://github.com/mokly-ai/mokly/issues/311)) ([bc4f4cc](https://github.com/mokly-ai/mokly/commit/bc4f4cc401f871e2fb3f4fd3be65f2d6533f524f))
* **sidecar:** warm up returned head processes while Serve is idle ([#351](https://github.com/mokly-ai/mokly/issues/351)) ([a2f61eb](https://github.com/mokly-ai/mokly/commit/a2f61eb53ddaa76f5ce08b60a30932207f5b6ebc))

## [0.19.0](https://github.com/mokly-ai/mokly/compare/v0.18.0...v0.19.0) (2026-11-12)


### ⚠ BREAKING CHANGES

* **viewer:** check catalogue content at receiver boundaries ([#285](https://github.com/mokly-ai/mokly/issues/285))
* **frame:** extract @mokly/frame and @mokly/model from the viewer ([#286](https://github.com/mokly-ai/mokly/issues/286))
* **viewer:** the in-frame script, its message channel, its wire version, and its page markers are renamed: /mokly-viewer/client/inspector.js becomes /mokly-viewer/client/frame-probe.js, the channel mokly-inspector becomes mokly-frame-probe with wire version 3, and the page markers become template[data-mokly-frame-probe] and data-mokly-frame-probe-link. A page published before this release and a viewer of this release reject each other, so publish each hosted catalogue again with this release.

### Features

* **frame:** extract @mokly/frame and @mokly/model from the viewer ([#286](https://github.com/mokly-ai/mokly/issues/286)) ([7058b0d](https://github.com/mokly-ai/mokly/commit/7058b0dde3252d0e982a47e030ebc0238c94f3d8))
* **html:** name warning sources and point prop errors at source ([6508b95](https://github.com/mokly-ai/mokly/commit/6508b9505e64eda3e7460a2b3c344f6258c086b5))
* **viewer:** check catalogue content at receiver boundaries ([#285](https://github.com/mokly-ai/mokly/issues/285)) ([b219642](https://github.com/mokly-ai/mokly/commit/b2196424d384ee9d0313fcafeda4608cca7900f7))


### Bug Fixes

* **cli:** exit watched Serve when its terminal closes ([#287](https://github.com/mokly-ai/mokly/issues/287)) ([a051315](https://github.com/mokly-ai/mokly/commit/a051315224d83e16b935706859d13dc9c68f3ed5))
* **compare:** hint every scripts-off base failure and skip pnpm prompts ([7d0682a](https://github.com/mokly-ai/mokly/commit/7d0682af43baf4ab2dfa5c4e31537aeddcdfb893))
* **css:** finish the approved CSS Modules scanner follow-ups ([9e57d86](https://github.com/mokly-ai/mokly/commit/9e57d8610b1996415a1415c44dab26efac4d8bbc))
* **deps:** update pulldown-cmark to 0.13.6 ([#282](https://github.com/mokly-ai/mokly/issues/282)) ([0e3c8e8](https://github.com/mokly-ai/mokly/commit/0e3c8e81a0d0f7d6772ec8f3474d78d46d96028b))
* keep the publish token out of output, viewer URLs, and sidecars ([e09bb3b](https://github.com/mokly-ai/mokly/commit/e09bb3ba6e46abdbba836227a2a149cc838f8b9a))
* **large:** restart the build deadline on each output line ([c7e7d9b](https://github.com/mokly-ai/mokly/commit/c7e7d9b88efc84152eb33539ed8ed7ca2ad2bb93))
* plain Windows paths, cache check form, base link names, test Git ([db48e47](https://github.com/mokly-ai/mokly/commit/db48e47386f125c229f30810ef23c0965919818b))
* **platform:** stop escaped script process trees on Unix ([1ac39fa](https://github.com/mokly-ai/mokly/commit/1ac39faf11f8ea8ba2c16db02aae3406af3518ba))
* **release:** build model before the frame registration archive ([7058b0d](https://github.com/mokly-ai/mokly/commit/7058b0dde3252d0e982a47e030ebc0238c94f3d8))
* **render:** key environments without the checkout folder ([3378cb3](https://github.com/mokly-ai/mokly/commit/3378cb3ba3cf49785d6317c5b85541375380f343))
* **viewer:** send same-origin cookies from the standalone shell ([#289](https://github.com/mokly-ai/mokly/issues/289)) ([b1c6d6b](https://github.com/mokly-ai/mokly/commit/b1c6d6be46ebe760a3533fec741015d511a284ff))
* **watch:** recover lost macOS and Windows events ([5529023](https://github.com/mokly-ai/mokly/commit/5529023c365c927ca44ce71499435e2c82b21e13))


### Performance Improvements

* **compare:** keep compact owned proof candidates ([6e02b32](https://github.com/mokly-ai/mokly/commit/6e02b32ddb88f3db6bf0ae1b9da44cba2a11e038))
* **serve:** share one verified copy among concurrent asset requests ([d148edc](https://github.com/mokly-ai/mokly/commit/d148edc50d21bb9eed756751f5b3429aba5e36be))
* **sidecar:** retain the last released compiled recipes ([2ca5774](https://github.com/mokly-ai/mokly/commit/2ca5774254aa30e9dfe33edee679fd0eae1abf57))


### Code Refactoring

* **viewer:** split the in-frame runtime into a core and a wrapper ([7058b0d](https://github.com/mokly-ai/mokly/commit/7058b0dde3252d0e982a47e030ebc0238c94f3d8))

## [0.18.0](https://github.com/mokly-ai/mokly/compare/v0.17.0...v0.18.0) (2026-11-01)


### ⚠ BREAKING CHANGES

* The catalogue index is version 9 and the entry detail is version 4. Each index record lists `detailId`. Each detail carries `detailId` and no `deploymentId`, and a removed detail no longer carries `generation`. Static builds write `mokly-viewer/deployment.json`. `@mokly/viewer` exports `EntryDetailV4` instead of `EntryDetailV3`. `readCatalogueIndex` reads version 9 only, and `readEntryDetail` reads version 4 only. Rebuild and republish every catalogue with the matching viewer. Mokly Cloud must accept index version 9.

### Features

* **cli:** show comparison steps while Changes loads ([#248](https://github.com/mokly-ai/mokly/issues/248)) ([afc9f58](https://github.com/mokly-ai/mokly/commit/afc9f58d20f3312cc9d73ceae55e270ed46dfe08))
* **dev:** install and build before npm run dev serves ([#250](https://github.com/mokly-ai/mokly/issues/250)) ([e9c2022](https://github.com/mokly-ai/mokly/commit/e9c20225af1b203bea236d29869c48f8c103668b))
* give entry details content ids and add a deployment file ([#224](https://github.com/mokly-ai/mokly/issues/224)) ([f93afce](https://github.com/mokly-ai/mokly/commit/f93afceaa1d94de3526c4825cc11708c951678ba))
* **ui:** move the controls to @mokly/ui, 2 of 5 ([#251](https://github.com/mokly-ai/mokly/issues/251)) ([7edabc3](https://github.com/mokly-ai/mokly/commit/7edabc306d6983c43824e1425782215e44e0d7f0))
* **ui:** move the inspector to @mokly/ui, 3 of 5 ([#253](https://github.com/mokly-ai/mokly/issues/253)) ([9f68de1](https://github.com/mokly-ai/mokly/commit/9f68de1695320adfec9ef5b112cd7865f313b283))
* **ui:** move the layout and theme to @mokly/ui, 5 of 5 ([#255](https://github.com/mokly-ai/mokly/issues/255)) ([8eb2b9a](https://github.com/mokly-ai/mokly/commit/8eb2b9a0ffc5fd49e15f996e7277fa4237ad46d5))
* **ui:** move the preview views to @mokly/ui, 4 of 5 ([#254](https://github.com/mokly-ai/mokly/issues/254)) ([8c2bbff](https://github.com/mokly-ai/mokly/commit/8c2bbff2c146a2f77f469668e342da127e3e0397))
* **ui:** move the shell chrome to @mokly/ui, 1 of 5 ([#249](https://github.com/mokly-ai/mokly/issues/249)) ([14c6f9e](https://github.com/mokly-ai/mokly/commit/14c6f9ec4c6a328bd90a5cc06481ebf45e409fd9))


### Bug Fixes

* **deps:** select patched minimatch for lint and release tools ([21c8663](https://github.com/mokly-ai/mokly/commit/21c86638f7719fa799eec11e3f39215c8ce98552))
* **graph:** carry unchanged public closures across replacements ([#244](https://github.com/mokly-ai/mokly/issues/244)) ([bb33139](https://github.com/mokly-ai/mokly/commit/bb33139552da58a3f69c52c418322821ceb9536a))


### Performance Improvements

* **render:** reuse stylesheet bundles with shared module evidence ([#242](https://github.com/mokly-ai/mokly/issues/242)) ([ee7d8ea](https://github.com/mokly-ai/mokly/commit/ee7d8ea739bd103aacd001f8e75e5aa144929348))

## [0.17.0](https://github.com/mokly-ai/mokly/compare/v0.16.1...v0.17.0) (2026-10-29)


### ⚠ BREAKING CHANGES

* keep a component's usage lists in its parent detail ([#223](https://github.com/mokly-ai/mokly/issues/223))
* catalogue index v8 and upload envelope v3. Viewers, hosts, and receivers that read index v7, review.json, or envelope v2 must upgrade. Mokly Cloud adopts the change in its own repository after the release.

### Features

* **html:** share one HTML driver between checks and trees ([#239](https://github.com/mokly-ai/mokly/issues/239)) ([02eec93](https://github.com/mokly-ai/mokly/commit/02eec9371e2cf46ef0dd075cb246b80e3826c9c9))
* keep a component's usage lists in its parent detail ([#223](https://github.com/mokly-ai/mokly/issues/223)) ([0a1d351](https://github.com/mokly-ai/mokly/commit/0a1d351dfae463893117f8a6e433ef01e36fe41b))
* **publish:** send gzip Blob bodies when the receiver lists gzip ([#221](https://github.com/mokly-ai/mokly/issues/221)) ([2dd2937](https://github.com/mokly-ai/mokly/commit/2dd2937f22b1671123a62cd51e2a11a536617b03))
* remove review.json; compare from the index and entry details ([#217](https://github.com/mokly-ai/mokly/issues/217)) ([c65aaef](https://github.com/mokly-ai/mokly/commit/c65aaef6b533cb4a004401f9593169d60b6d92bf))
* **ui:** add the @mokly/ui shared UI package ([#243](https://github.com/mokly-ai/mokly/issues/243)) ([e4c6d2c](https://github.com/mokly-ai/mokly/commit/e4c6d2c850fd26dd10392d061c6c9c2ae5d2af25))
* warn on stylesheet renderer seeds and align the docs ([#218](https://github.com/mokly-ai/mokly/issues/218)) ([89c12ef](https://github.com/mokly-ai/mokly/commit/89c12ef1726bd29cd5e8c029e83bbe58dba7e3de))


### Bug Fixes

* **config:** give config-relative paths one normalized form ([#240](https://github.com/mokly-ai/mokly/issues/240)) ([843ac8b](https://github.com/mokly-ai/mokly/commit/843ac8bf0ec2b1a91fa21b57231591d96e6844cd))
* **css:** align CSS Modules scanners with cssparser (user item 111 C) ([#241](https://github.com/mokly-ai/mokly/issues/241)) ([c9d402c](https://github.com/mokly-ai/mokly/commit/c9d402cdfa5f0c8301be67e8d46868854164a9f6))
* **deps:** update pulldown-cmark to 0.13.5 ([#230](https://github.com/mokly-ai/mokly/issues/230)) ([9f78200](https://github.com/mokly-ai/mokly/commit/9f78200e3f85ce000cac34769bd0d317dfd43731))
* **git:** read unreadable extraction files through Git ([#237](https://github.com/mokly-ai/mokly/issues/237)) ([3ea78c0](https://github.com/mokly-ai/mokly/commit/3ea78c0b4cc55051668fd75afb3b40f6927bec6c))
* **graph:** key unattributed definitions and unnamed previews exactly ([#235](https://github.com/mokly-ai/mokly/issues/235)) ([c92c1a7](https://github.com/mokly-ai/mokly/commit/c92c1a7f7787bffd18c3598b7f439b3243daf012))
* **graph:** report closure warnings in Serve and previews (finding 1) ([89c12ef](https://github.com/mokly-ai/mokly/commit/89c12ef1726bd29cd5e8c029e83bbe58dba7e3de))
* **postcss:** keep the paths of hook-supplied modules ([#238](https://github.com/mokly-ai/mokly/issues/238)) ([10dd5a0](https://github.com/mokly-ai/mokly/commit/10dd5a01a88c0b47f18ee16ba2587f2dc439bcf6))
* **verification:** name the right command in two errors (finding 5) ([89c12ef](https://github.com/mokly-ai/mokly/commit/89c12ef1726bd29cd5e8c029e83bbe58dba7e3de))


### Performance Improvements

* **build:** capture head documents once during the build check ([#220](https://github.com/mokly-ai/mokly/issues/220)) ([a9dd1e8](https://github.com/mokly-ai/mokly/commit/a9dd1e81562c4acaacec4a512967c38d1db80de3))
* **compare:** read base files from the leased extraction ([#236](https://github.com/mokly-ai/mokly/issues/236)) ([aab537b](https://github.com/mokly-ai/mokly/commit/aab537bdf0aca61eb731d258c2f54c51bda0e316))
* **git:** convert base batches in one Git process, time the extraction ([#229](https://github.com/mokly-ai/mokly/issues/229)) ([d4c6f6a](https://github.com/mokly-ai/mokly/commit/d4c6f6a825dc73af66e8df524d67e7f6d876a547))
* **graph:** bundle stylesheet roots in parallel ([#228](https://github.com/mokly-ai/mokly/issues/228)) ([c83becc](https://github.com/mokly-ai/mokly/commit/c83beccfcfbc36a503c681a2a59c9a08f0596b74))
* per-entry render keys and cross-side render reuse ([#227](https://github.com/mokly-ai/mokly/issues/227)) ([9ce7585](https://github.com/mokly-ai/mokly/commit/9ce7585394f36c01aa54cd2a274f2d46fd672d6b))
* **serve:** render the background pass in bounded batches ([#225](https://github.com/mokly-ai/mokly/issues/225)) ([9c56286](https://github.com/mokly-ai/mokly/commit/9c56286d1bb89096f24392ba7a3c955cbf816f3c))
* **serve:** smaller cache charges, cache counts, covered-root recheck ([#222](https://github.com/mokly-ai/mokly/issues/222)) ([140bb0e](https://github.com/mokly-ai/mokly/commit/140bb0ef8fbfa3d048303b70588d2a8c5cfd86a4))
* **sidecar:** resolve bundle imports natively and plan a second compile ([#226](https://github.com/mokly-ai/mokly/issues/226)) ([3192b19](https://github.com/mokly-ai/mokly/commit/3192b19b9060f0905d9f573784bce787b4f3707c))

## [0.16.1](https://github.com/mokly-ai/mokly/compare/v0.16.0...v0.16.1) (2026-10-26)


### Bug Fixes

* **release:** verify native packages of other platforms ([#207](https://github.com/mokly-ai/mokly/issues/207)) ([66e1ba6](https://github.com/mokly-ai/mokly/commit/66e1ba6afa936d01689a33fd6f1e2d69f983eb47))

## [0.16.0](https://github.com/mokly-ai/mokly/compare/v0.15.0...v0.16.0) (2026-10-25)


### ⚠ BREAKING CHANGES

* The `mokly` CLI is a native Rust binary. `@mokly/mokly` selects it from the matching `@mokly/native-{target}` package for Linux x64 or ARM64 with glibc 2.28 or newer, macOS 11.0 or newer on x64 or ARM64, or Windows x64. There is no JavaScript CLI fallback, so keep optional dependencies enabled during installation. Mokly supports Node 22.15.0 and later 22.x releases, and Node 24.0.0 and later except 24.14 through 24.18. Node 23 is not supported. The [upgrade guide](docs/guides/start/upgrade.md) gives all upgrade steps.
* Use `serve` to browse with watch enabled by default. Use `build` to validate, render every view, and write a static site. Use `publish` to build a private site and upload it. `check`, `export`, and `review` are removed. Run `mokly build --strict --out {temporary-directory}` to validate, and replace `export --out` with `build --out`. `build --watch` and `serve --build` are removed. Use `serve` for development.
* The configuration is the data-only file `mokly.config.json`, and `--config` names another JSON file. TypeScript and JavaScript configuration, `defineConfig`, `componentStylesheets`, `ModuleResolutionConfig`, `ReviewConfig`, `StylesheetRule`, `WatchAction`, `WatchConfig`, and `WatchRule` are removed. Paths resolve from the configuration file. `$componentStylesheets` is the only stylesheet token. Brace alternatives such as `{a,b}` replace extglob matches. Use the shipped `config.schema.json` for editor checks.
* No command writes generated output into the repository. Remove committed `mokly-generated/` output and `.mokly-cache`. `build` writes `mokly-static/` by default, and Git must ignore it. Comparisons render both sides from sources with the installed Mokly version, and a base whose sources fail current validation makes Changes unavailable. `serve`, `build`, and `publish` accept `--base`. There is no committed baseline. Use `movedFrom` to identify an entry that moved with content changes.
* Every screen and component has its own props and optional variants. `defineScreen` and `defineComponent` use `render(props, context)`. Each export contributes one definition, so array exports fail. A Storybook file contributes one component, with its stories as variants. `argTypes` gives control hints only. `definePage` returns one complete document. Prop schemas use a strict JSON Schema 2020-12 profile with closed objects. `ComponentEntryDefinition`, `ComponentProps`, `ComponentRenderContext`, `ComponentVariant`, `ComponentVariantDefinition`, `RegisteredComponent`, and `RegistryDefinition` are removed.
* `@mokly/viewer/server`, `@mokly/viewer/runtime`, `renderViewer`, shell hydration, and embedded bootstrap data are removed. `MoklyViewer` takes `index` and `detail` sources, and `readCatalogueIndex` and `readEntryDetail` replace `readCatalogue`. Catalogues use index v7 and entry detail v2, review results v8, change snapshots v4, and the live descriptor v3, and each reader accepts one version. `@mokly/viewer/data` exports only the path functions, the directory names, the path and link grammar, and the prop schema validators. Import `ColorScheme`, `Viewport`, `MoklyVersionError`, `resolveInstance`, and `InstanceResolution` from `@mokly/viewer`. The viewer now shares the CLI version. Rebuild every published catalogue. Mokly Cloud resets and republishes with the matching viewer, and the upload exchange stays v1.

### Features

* author screens and components as HTML with YAML front matter ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))
* read the configuration from mokly.config.json ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))
* rebuild the Mokly backend as a Rust core ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))
* render comparisons from sources without generated output ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))
* render the Browse shell in the browser from catalogue index v7 ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))
* replace check, export, and review with serve, build, and publish ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))
* use one props and variants model for every entry kind ([#199](https://github.com/mokly-ai/mokly/issues/199)) ([d935e6a](https://github.com/mokly-ai/mokly/commit/d935e6a6613b057d343c56aea4aba52f47a71d00))


### Bug Fixes

* **deps:** resolve dependency audit findings ([#200](https://github.com/mokly-ai/mokly/issues/200)) ([12681c8](https://github.com/mokly-ai/mokly/commit/12681c8ba03061f457bdb58952edf1bec16d9828))

### Upgrade Notes

#### First Rust Core Release

The first Rust core release is a breaking 0.x minor release. Install `@mokly/mokly`; npm
selects its matching viewer and native dependencies. Rebuild all
published catalogues. No compatibility reader or converter exists for older
configuration, authoring modules, generated output, or caches.

##### Commands And Configuration

- Use `serve` to browse with watch enabled by default. Use `build` to validate,
  render every view, and write a static site. `publish` builds a private site
  and uploads it. `check`, `export`, and `review` are absent. For validation,
  run `mokly build --strict --out {temporary-directory}`. Replace
  `export --out` with `build --out`. `build --watch` and `serve --build` are
  absent; use watched Serve for development.
- Configuration is data-only `mokly.config.json`. `--config` names another JSON
  file. TypeScript and JavaScript configuration and `defineConfig` are absent.
  Use the shipped `config.schema.json` for editor checks. Filesystem paths are
  relative to the configuration file. `$componentStylesheets` is the only
  stylesheet token. Replace the `componentStylesheets` JavaScript export
  with this token in the JSON stylesheet list. `WatchConfig` and `ReviewConfig`
  are removed configuration types.
  Replace extglob stylesheet matches such as `@(a|b)` with brace alternatives
  such as `{a,b}`. Unsupported extglob matchers emit a `stylesheet-extglob`
  configuration warning that names the pattern and suggests brace alternatives.
  `--strict` fails on this warning under the normal build-warning policy.
  Replace flat generated-filename matches with entry routes such as
  `product/**/index.html`. Local stylesheet paths resolve from the JSON file.
  Remove `.css: "text"` loader overrides. Import CSS normally so the core
  delivers its stylesheet and referenced assets.
- Do not commit generated output. `build` defaults to `mokly-static/`, which
  must be ignored by Git. Remove committed `mokly-generated/` output and
  `.mokly-cache`. Serve and comparisons render in memory. Base extraction and
  dependency caches use the operating system's cache directory.
- `serve`, `build`, and `publish` accept `--base`. `build` and `publish` accept
  `--no-changes`. Publish has no `--out`; it names its private build directory
  before building and keeps it after a failed upload. Publish requires a clean,
  committed checkout. Static output requires an empty directory or its valid
  ownership marker.
- `build` fingerprints only what the build uses: the configuration, root
  membership, inventoried sources, and the files that rendering reaches. An
  edit to an unrelated repository file does not stop a build. Some edits made
  while a build runs are not detected. These are edits to JavaScript modules
  that Mokly bundles from `node_modules`, to files under `node_modules` that a
  PostCSS plugin reports, to `.gitignore` or the Git index, to ancestor
  `tsconfig.json` files, to ancestor `package.json` files that PostCSS module
  resolution does not name, to missing resolution candidates, to the file list
  of a directory that a PostCSS plugin reports, to files that a PostCSS plugin
  reads without reporting them, and to files that render callbacks read
  without an import. These include an installed stylesheet that a PostCSS
  plugin inlines. Edits to installed stylesheets that Mokly resolves itself,
  their `url()` assets, the `package.json` files that this resolution reads,
  PostCSS plugin modules, and the package manifests that PostCSS module
  resolution names stop the build. A PostCSS plugin can also read a file that
  it reports in a way that Mokly cannot observe, such as through a native
  addon. For a reported repository file outside `node_modules`, Mokly records
  its digest after the read and does not detect an edit between the two. Such
  output is consistent but stale. Build again after such an edit. `publish`
  checks the repository status again before upload and rejects an edit to any
  file that Git does not ignore.

##### Platforms And JavaScript

The npm shim selects one version-matched Rust binary. Supported targets are
Linux x64 and ARM64 with glibc 2.28 or newer, macOS 11.0 or newer on x64 and
ARM64, and Windows x64 with MSVC. The binary uses the supported Node runtime's OS floor. Windows
links its C runtime statically and needs no separate Visual C++ runtime.
There is no JavaScript CLI fallback. Keep optional dependencies enabled during
installation. Mokly supports Node `>=22.15.0 <23.0.0 || >=24.0.0 <24.14.0 || >=24.19.0`; the shim rejects
unsupported versions before binary lookup.

HTML-only catalogues need no JavaScript sidecar. React and Storybook authoring,
page callbacks, and consumer PostCSS start sidecars as needed. React and React
DOM come from the consumer. The sidecar bundles JavaScript; the Rust core owns
CSS Modules, document assembly, caching, and invalidation.

##### Authoring And Comparison

HTML screens and components use leading YAML front matter. Their bodies share
`{{name}}`, `$name`, `mokly-if`, and `mokly-viewport`. Components can declare
slots. Complete HTML pages and YAML use cases need no JavaScript.

Every screen and component has its own props and optional variants. A variant
replaces top-level prop keys. `defineScreen` and `defineComponent` use
`render(props, context)`, with `context` containing `viewport` and `colorScheme`.
Each export contributes one definition; array exports fail. A Storybook file
contributes one component, with its stories as variants and their args as props.
`argTypes` supplies control hints and does not define validation. `definePage`
returns one complete synchronous document.

Replace uses of a registration's `.entries` with its definition. Update code
that indexes exported arrays or reads `id`, `navPath`, or `variantOf` from
renderer input. Keep instance names separate from entry paths: `moklyInstance`
uses lowercase kebab-case and cannot contain path separators.

Renderer modules return a React node or `{ node, resources }`. Their input
has `props` and an entry address with `kind`, `path`, and `title`. The core
assembles the document and stylesheet links. Put theme attributes and `lang`
on the renderer's wrapper element.
Update CSS selectors that depend on consumer attributes on `html` or `body`.
Pass caller-specific values, such as a palette, through declared component
props. Each component render establishes its own providers; arbitrary caller
React context does not cross that boundary.

Prop schemas use the strict JSON Schema 2020-12 profile. Object schemas must
be closed with `additionalProperties: false`. Defaults, references, and
unsupported keywords fail. The schema can be inferred where the entry contract
permits it. Non-data values are excluded with a warning. See
[entry props](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-entry-props.md).
Supply valid parent props as well as variant props. Move saved React slot
content into each variant's `slots` field. At registered instance boundaries,
omit absent optional data keys instead of passing `undefined`, including
inside nested objects. Keep generic input helpers aligned with the public
schema-inference types and check them against the installed declarations.
Keep catalogue fixture data in the consumer source tree instead of importing
internal fixture files from the installed CLI package.

Comparisons render both sides from sources with the installed Mokly version.
A base whose sources fail current validation makes Changes unavailable with
those diagnostics. Base JavaScript reuses identical-lockfile dependencies,
installs a differing lockfile into the bounded cache with lifecycle scripts
disabled, or warns and uses working-tree dependencies if installation fails.
There is no committed baseline output. Entry paths derive from files; use
`movedFrom` to identify an entry moved with content changes.

Tree comparison removes ignored regions and head styles before materiality
checks. Changed CSS contributes rule evidence through selector matching.
Source dependency declarations do not determine Changes. Instance and slot
markers remain in delivered documents for inspection. Ignore and logical-link
markers are consumed during composition.

Component parents render their own views from their props. Static Changes
captures both sides of pages and Markdown documents and their resources.
Configured CSS uses `styles/{repository-relative stylesheet path}` under
`static/mokly-generated/`; referenced authored files use their repository
paths under `static/`. Base snapshots include the same generated delivery
roots as current output.
Rewrite authored relative URLs so they resolve from the document route to
`static/{repository path}`.

Schema, control, and declared-slot metadata changes list the component parent.
Variants keep independent metadata, props, and supplied-slot changes. A shared
schema edit alone does not add one Changes row per variant.

Caller-owned component props remain material when the rendered HTML is equal.
Review records keep every applicable reason, including both `inputs` and
`material`. The view's `ignoredIds` lists every paired region used for
equality, including equal regions in unchanged views.
React-generated accessibility IDs can change after structural edits. Those
attribute changes can supply actual-instance implementation evidence even
when the component's saved views stay unchanged.

CSS evidence names delivered resource routes. Unowned head-style edits use
per-rule records at the containing public document route. A removed view keeps
matched and conservative rule records from its available before-side tree.
Missing entries use their `added` or `removed` reason; `material` describes a
paired view's canonical-form change.

A use case has no views, so its review aggregate stays `unchanged` while
its screen reasons independently include it in Changes.

Affected-consumer chains start inside that consumer. They omit its own
instance and outer ancestors; each context keeps its side and variant address.

##### Viewer And Wire Formats

The Browse shell renders in the browser. Serve and static builds deliver the
same shell stub, catalogue index v7, and entry detail v2. Review results use v8,
change snapshots use v4, and the live descriptor uses v3. Readers accept one
version only. The [format inventory](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-format-versions.md) owns all numbers.

Use the viewer's root, `./browser`, `./data`, and `./styles.css` entries. The
`./server` and `./runtime` entries, `renderViewer`, shell hydration, and embedded
bootstrap data are absent. `./data` exports only the path functions, the
directory names, the path and link grammar, and the prop schema validators. `MoklyViewer` takes index and detail sources.
`readCatalogueIndex` and `readEntryDetail` read those boundaries.
`resolveInstance` and `InstanceResolution` are available only from
`@mokly/viewer`; remove imports of them from `@mokly/mokly`. The index has
one revision and a document key per document; updates refresh affected frames
without reloading the page. Serve sends no cross-origin response headers.

Mokly Cloud must reset and republish its catalogue with the matching viewer and
receiver. The Plan, Blob, Complete upload exchange remains v1; its validation
rules and content-delta behavior do not change.

##### Deep Trees And Scale Tools

HTML trees use explicit work stacks for composition, repair, serialization,
cloning, equality, and destruction. They need no enlarged thread stack.
`plaintext` has no synthetic closing tag. Its parsed tree is the stable
browser repair of the serialized payload, including formatting clones and
foster-parented content. Initial newlines in `pre`, `textarea`, and `listing`
survive repeated parsing.

The opt-in large fixture has native HTML and React variants. Component parent
views and Markdown documents give 5,850 documents across 1,620 routes. Generated
output is ignored. One Markdown document per area exercises Markdown rendering
in both colour schemes. The harness uses the Rust CLI and records build, Serve,
Changes, and watch measurements. Workspace reuse and isolated installs are
distinct modes. The opt-in benchmark enforces the
[approved release startup budgets](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-timings.md#budgets).
Automated correctness tests have no wall-clock assertions.

#### Rust Rebuild

The first Rust core release is a breaking 0.x minor release. The
[complete upgrade note](#first-rust-core-release)
covers native targets, removed commands, JSON configuration, HTML authoring,
source comparisons, caches, formats, and the required Mokly Cloud reset.

JSON configuration removes `defineConfig`, `componentStylesheets`,
`ModuleResolutionConfig`, `ReviewConfig`, `StylesheetRule`, `WatchAction`,
`WatchConfig`, and `WatchRule`.
The unified authoring model removes `ComponentEntryDefinition`,
`ComponentProps`, `ComponentRenderContext`, `ComponentVariant`,
`ComponentVariantDefinition`, `RegisteredComponent`, and `RegistryDefinition`.
The CLI also stops exporting `ComponentInstanceRecord`, `ComponentPropsData`,
`ComponentResourceOwnership`, `ComponentSourceLocation`,
`ComponentStyleOwnership`, `PropPrimitive`, and `PropValue`. Use the current
entry props and viewer records. Import `resolveInstance` and
`InstanceResolution` only from `@mokly/viewer`.

#### Viewer Delivery

The Browse shell renders only in the browser, from the catalogue index v7 and
one entry detail v2 per entry under the
[shell delivery contract](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-shell-delivery.md). `@mokly/viewer/server`
and `@mokly/viewer/runtime` are removed, and `@mokly/viewer/browser` mounts
the standalone shell without `hydrateMoklyShell`. `MoklyViewer` takes an
`index` source and a `detail` source and has no `viewerId`. `readCatalogueIndex`
and `readEntryDetail` replace `readCatalogue`; `IndexSource`, `DetailSource`
and `DetailResult` replace `CatalogueSource` and `CatalogueFetcher`. Prop
schemas follow the JSON Schema profile of the
[entry props contract](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-entry-props.md): `PropSchema` and
`validatePropSchema` replace `ObjectPropSchema`, `DataPropSchema`,
`DataPropField`, `InferProp` and `ControlFor`. `@mokly/viewer/data` no longer
exports `parseStaticDelivery`, `StaticDelivery`, `StaticDeliveryParseResult`
or `RenderCapability`; the standalone shell reads the live descriptor v3.

#### Viewer Data

`@mokly/viewer/data` exports only the path functions, the directory names, the
path and link grammar, and the prop schema validators that the
[viewer contract](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-viewer.md) lists. Review result v8 replaces the review
v7 and manifest types, so the entry no longer exports them or their readers and
helpers. Import `ColorScheme`, `Viewport`, and `MoklyVersionError` from
`@mokly/viewer`. The entry also stops exporting `AffectedConsumer`,
`AffectedUsageEvidence`, `ArtifactView`, `CatalogueHierarchy`, `ChangedEntry`,
`ComponentControl`, `ComponentControlLabel`, `ComponentRenderError`,
`ComponentRenderRequest`, `ComponentRenderSuccess`, `ComponentReview`,
`ComponentUsageContext`, `ComponentValidationError`, `ComponentVariantReview`,
`DataBudget`, `DependencyReason`, `EntryChangeReason`, `ExcludedResource`,
`GeneratedComponentView`, `HierarchyEntry`, `HierarchyFolder`, `HierarchyNode`,
`HistoricalManifest`, `HistoricalManifestEntry`, `HistoricalManifestPage`,
`HistoricalManifestScreen`, `HistoricalManifestUseCase`,
`HistoricalSnapshotSource`, `HtmlSourceLocation`, `LogicalTarget`, `Manifest`,
`ManifestDocument`, `ManifestEntry`, `ManifestEntryBase`, `ManifestFolder`,
`ManifestPage`, `ManifestScreen`, `ManifestV10`, `RemovedPagePreview`,
`RemovedPagePreviewArtifact`, `ReservedAttributeName`,
`ReservedAttributeOccurrence`, `ResolvedCatalogueEntry`, `ReviewArtifact`,
`ReviewArtifactContent`, `ReviewEntryAddress`, `ReviewResult`,
`ReviewResultV7`, `ReviewState`, `ReviewVariantAddress`,
`ScreenResourceEvidence`, `ScreenReview`, `ScreenReviewV7`, `VIEWPORTS`,
`ViewResourceEvidence`, `ViewReview`, `affectedConsumerOrderKey`,
`analyzeHierarchy`, `canonicalJson`, `catalogueComponentVariants`,
`compareNavigationNodes`, `comparisonGeneration`, `comparisonPath`, `counter`,
`currentCatalogueEntries`, `decodeProps`, `decodeValue`,
`duplicateReservedAttributeName`, `effectiveColorSchemes`, `encodeProps`,
`encodeUrlPath`, `exactKeys`, `firstPathCaseCollision`, `fragmentViews`,
`generatedViews`, `historicalSnapshotId`, `instanceKey`, `invalidData`,
`isHistoricalSnapshotId`, `isKebabCase`, `isManifestComponentVariant`,
`isPortableUrlPath`, `isSafeCatalogueRoute`, `isSafeRepositoryPath`,
`isStylesheetPath`, `lexical`, `logicalMarker`, `parseBrowsingTarget`,
`parseLogicalMarker`, `parseLogicalTarget`, `parseRemovedPagePreview`,
`parseReviewResult`, `plainKeys`, `projectTree`, `readControls`, `readInstance`,
`readProps`, `readRange`, `readSchema`, `readSlot`, `relatedDoc`,
`renderStatus`, `repositoryPath`, `requireEqual`,
`reservedAttributesInStartTag`, `resolveCatalogueEntry`,
`resolveCatalogueSelection`, `resolveLinkPath`, `reviewInvalid`,
`reviewMaterialKey`, `serializeBrowsingTarget`, `slotKey`, `sortedStrings`,
`validateComponentSource`, `validateComponentViewRecord`,
`validateComponentViews`, `validateControlledValues`, `validateControls`, and
`validateResourcePath`. These have no public replacement.

The entry also removes `CssPageEvidence`, `CssRuleAttribution`,
`DependencyAnalysis`, `InsertedComponentStylesheet`, `PageResourceEvidence`,
`ResourceEvidence`, `cssAnalysis`, and `mergeCssAnalysis`.

## [0.15.0](https://github.com/mokly-ai/mokly/compare/v0.14.0...v0.15.0) (2026-10-12)


### ⚠ BREAKING CHANGES

* Entry `dependencies`, component `ownedDependencies` and `review.sharedImpact` have no effect. Mokly warns and ignores them, and a `--strict` command fails on these warnings. Delete them, and declare component CSS with the component's `stylesheets` field.
* Generated output uses manifest v10, catalogue read model v6 and review result v7. Rebuild and commit `mokly-generated/` output that 0.14.0 or earlier wrote, and regenerate exports. A comparison base that 0.14.0 or earlier built shows Changes as unavailable until the base includes this version. Hosts that embed the viewer need `@mokly/viewer` 0.6.0 to read catalogues from this release.
* Rename `ManifestV9`, `ReviewResultV6` and `ScreenReviewV6` to `ManifestV10`, `ReviewResultV7` and `ScreenReviewV7`. `MoklyVersionError.boundary` can now be `"review"`.

### Features

* classify each changed CSS rule by the elements that it matches ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* declare component CSS with the `stylesheets` field ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* move generated output to manifest v10, catalogue read model v6 and review result v7 ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* remove source-path evidence inputs ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* rename the versioned manifest and review types ([#179](https://github.com/mokly-ai/mokly/issues/179)) ([34e4bb0](https://github.com/mokly-ai/mokly/commit/34e4bb0324c5e22e98f21120a800e2a165481d34))
* **xtask:** run the remote gate from a pushed base commit ([#193](https://github.com/mokly-ai/mokly/issues/193)) ([d9f2148](https://github.com/mokly-ai/mokly/commit/d9f2148332f53eee5bc991a2db39a32792d1b25e))


### Bug Fixes

* ignore foreign links, keep snapshot forms, remove wording tests ([#191](https://github.com/mokly-ai/mokly/issues/191)) ([c66daeb](https://github.com/mokly-ai/mokly/commit/c66daeb58d3b3e822dfd0482a587a8f3a8e58218))
* **release:** repair release evidence and manual complete retries ([#183](https://github.com/mokly-ai/mokly/issues/183)) ([a0e1219](https://github.com/mokly-ai/mokly/commit/a0e1219c0541618e882f563f8f73b13bb00e7fa3))
* **server:** keep authored files readable across reloads and restarts ([#185](https://github.com/mokly-ai/mokly/issues/185)) ([a90badb](https://github.com/mokly-ai/mokly/commit/a90badb6a79c05a20fb938e894232e0b5b946b30))
* **xtask:** warn on stuck boxes after suites ([#181](https://github.com/mokly-ai/mokly/issues/181)) ([1086732](https://github.com/mokly-ai/mokly/commit/1086732a634f0fa42837f45dd290745d114f9701))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @mokly/viewer bumped from 0.5.0 to 0.6.0

### Upgrade Notes

#### Generated Output And Manifest API

`MoklyConfig` no longer accepts `generatedOutput` or `publicExclude`.
`mockupsDir` names the authored catalogue root, and all generated files live in
its `mokly-generated/` child. Only Build, `build --watch` and `serve --build`
write that tree. Plain Serve, export and publish compile in memory. Check uses
Git-index tracking to choose its tracked or untracked validation boundary.
Remove the old options; no default-output mode replaces them.

Manifest v10 replaces the released manifest v9. `@mokly/viewer/data` no longer
exports the manifest types. The
[viewer data release note](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/npm-release-notes.md#breaking-viewer-data-release-note) lists them.
V10 still requires `assetClosure`, `generatedFiles` and `blobHashAlgorithm` in
addition to the identity-only entries and source inventory.
The combined shape requires root ranges and inserted-stylesheet provenance, and
removes source dependency declarations.
Only valid v10 baselines are read. npm 0.14.0 output (manifest v9, catalogue v5
and review v6) is earlier output.
Former manifest filenames no longer act as sentinels. Missing canonical output
uses normal absence and rebuild selection.
Rebuild committed `mokly-generated/` once with Build, commit it, and regenerate
exports. Do not hand-convert manifests.
An earlier base gives Changes unavailable with the existing message. Build,
Serve, export and publish succeed. Earlier outcomes are never cached.

#### Path Identity

The path identity upgrade removes `id`, `navPath`, `entries`, and `entriesDir`.
The removed nested authoring types include `NestedFolderInput` and `RootInput`.
Each entry has one path derived from its discovered exporting file. It adds Markdown
documents and move detection, renames Pages to Specs, and gives each entry a
generated directory. Consumers must adopt manifest v10, catalogue read model
v6, review result v7, disclosure storage v4, and `/view/<path>/` URLs.

Earlier formats, URLs, ids, disclosure keys, and configuration are not read or
translated. There is no compatibility reader, URL redirect, id mapping,
storage-key conversion, configuration fallback, or migration tool. Former
configuration fields fail as unknown fields, except the removed
`review.sharedImpact` input, which warns and has no effect. An earlier comparison base makes
Changes unavailable until it includes this version. Migration is manual;
regenerate the catalogue after changing authoring and update saved entry links.

Generated HTML has one plain notice, which proves no ownership. The complete
`mokly-generated/` tree belongs to Mokly; authored assets stay outside it.
Preview builds do not adopt `.mokly-preview-artifact` output. Preserve authored
files, delete an old export destination, and export again. Do not rename headers
or markers to claim ownership. Current export ownership uses schema 3.

This release also removes source-path evidence. Delete entry `dependencies`,
removed component `ownedDependencies` and `review.sharedImpact`. Current authoring
helpers warn once when these keys are present and ignore their values. Public
input types use `?: never` for removed authoring fields; explicit `undefined`
needs `exactOptionalPropertyTypes` for a type error. Strict commands count these
warnings before any output write or upload.
Declare separately authored component CSS with `stylesheets` and place it with
`componentStylesheets` when
needed. The shared public-file policy refuses symbolic links at every public path
component, including declared CSS and renderer links. Remove public stylesheet
aliases and use regular files. Only configured links anchor component CSS
placement. Reused renderer links
receive no inserted provenance. The renderer keeps its configured and generated
CSS list. Ordinary package edits finalize private full-link spans; no transformer
or transient token remains.

Changes uses rendered output, reachable resources, reviewable metadata and
component usage. All CSS delivery paths use the same changed-rule test: kept
own-page matches change a component; outside matches and unresolved rules give
the page a direct row. Source-only edits add no evidence. Details omit the
source dependency list. The combined current formats use new versions:
manifest v10 includes root ranges and `insertedStylesheets` with
`componentPaths`; catalogue v6 carries view/page `resourceEvidence`; review v7
carries `ruleKey`, `changedComponentPaths`, `pageSelectors` and `pageEvidence`.
Manifest dependency declarations, catalogue `details.dependencies`, review
`sharedImpact` and entry dependency lists are absent. Earlier shapes are not
read. Rebuild baselines and regenerate public exports. Former `mokabook-`
component and Review-ignore comments are ordinary content, with no translation.

Migrate authoring as follows:

- Replace `entries` and `entriesDir` with `roots`; omit it for the default
  `specs` root, or list `{ dir, files?, path?, transparent? }` objects.
- Remove `id` and `navPath` from every definition. Move each file to the
  directory that should be its folder, or declare `path`. Rename the file, or
  declare `slug`, when the leaf should differ from the file name; declare
  `slug: "index"` or name the file `index.mockup.tsx` for a folder's own page.
- Replace `defineRoot`, `folder`, nested `screen`, and nested `page` with
  directories and `defineFolder` records or `_folder.json` files for titles
  and order.
- Give every variant a `slug` instead of an `id`; `variantOf` is derived.
- Replace `useCaseIds` with `useCasePaths` and step `screenId` with
  `screenPath`, using complete or relative paths.
- Export definitions from any export, default or named; `mockups` is no
  longer required.
- Replace `mockLink("<id>")` and `to="<id>"` with a complete path, a relative
  path, or an imported definition. Raw `mock:<id>` becomes `mock:<path>`.
- Declare `movedFrom` on an entry whose path changed together with its
  content so Changes pairs it with its baseline.

Migrate the released `@mokly/viewer/data` exports as follows: `entryRoute`,
`viewRoute`, `viewHref`, `snapshotViewPath`, and `snapshotResourcePath` take a
path instead of `(kind, id)`; `snapshotPagePath` becomes
`snapshotDocumentPath(side, path, colorScheme)`; `pagePreviewMetadataPath`
becomes `previewMetadataPath(path)`; `documentRoute` is new; and
`unavailableViewHref` is removed because `viewHref` of an unknown path opens
the missing view. `parseViewHref` returns a path rather than a kind and id.
The released manifest and review result types, such as `ManifestV7` (0.13.0),
`ManifestV9` (0.14.0), `ReviewResultV6`, and `ScreenReviewV6`, have no public
replacement. The
[viewer data release note](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/npm-release-notes.md#breaking-viewer-data-release-note) lists their
0.15.0 successors, such as `ManifestV10` and `ReviewResultV7`, which the first
Rust core release removes. Replace
`isEntryId` and `isCatalogueId` with `isPathSegment` and `isEntryPath`;
`isWindowsDeviceName` is unchanged.

Migrate the released `@mokly/viewer` root types as follows: `CatalogueRecord`
and every node carry `path` instead of `id`, `useCasePaths` replaces
`useCaseIds`, `screenPath` replaces `screenId` in steps and in `InstanceRef`,
`CatalogueDocument` is a new record kind, `CatalogueReadModel.tree` is one
tree whose folder nodes carry `title` and optional `index`, removed entries
carry `folderTitles`, and paired entries carry `previousPath`. Viewer hosts
replace `ViewerSelection.screenId` and `ScreenNavigateEvent.screenId` with
`screenPath`.

The path identity change also removes the obsolete nested input types
`NestedFolderMarker`, `NestedPageInput`, and `NestedScreenInput` from the authoring
package, and `ViewHrefIdentity`, `navConflictKey`, `navPathKey`, and `validNavLabel`
from the viewer data package. The public replacement is the path model described
in [paths](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-paths.md) and [entry modules](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-entry-modules.md).

#### Boundary And Tooling

`parseStaticDelivery` returns `valid`, `unsupported-version` or `invalid`
results and never throws. Callers read the descriptor from a valid result's
`value`. Browser boundary readers throw `MoklyVersionError`; export keeps
`export-invalid`. `ViewerError.code` includes `version`, with optional
diagnostic `details` beside the existing product-facing `message`.

`MoklyVersionError.boundary` now also accepts `"review"`. The review reader
throws that error for numeric versions other than 7 before reading content.
Comparison requests preserve its code, boundary, received version and supported
version. Malformed current results keep a plain invalid-review error with one
`[mokly/review]` prefix. Comparison failures use the existing compatible-viewer
message, with version numbers only in diagnostic details. Embedded viewers emit
`onError` with code `"version"`; Current remains available without comparison panes.

The watch-writer change that was to move successful plain baseline notes and
the earlier-version notice to stdout is frozen with the TypeScript backend and
never landed; errors and requested timing JSON retain stderr. Referenced authored files are not private solely because of an extension
or build-folder name; source inputs, protected locations, hidden segments and
symlinks remain private.

#### Combined Path And Output Formats

The path/output integration uses manifest v10, catalogue v6, review v7, delivery
v5 and bootstrap v2. Live capability descriptors and the inspector wire use v2;
the live index is `live-index-2`, catalogue change snapshots use v3 and baseline
completion markers use v2 with `generated-v10`. Export ownership v3, upload v2
and Plan v1 retain their shapes. See the
[complete format inventory](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-format-versions.md).

File-derived paths replace `id`/`navPath`, and `roots` replaces `entries` and
`entriesDir`. Markdown documents, folders and moves use the incoming path
contract. Every generated file now lives under `mokly-generated/`, including
Markdown resource copies. Manifest v9 and below are earlier baseline output;
catalogue v5 and review v6 and below are unsupported public payloads. Rebuild
with the matching package; no converter is provided. The preview command against
an earlier main base still succeeds with Changes unavailable. Only the explicit
writers take the output lock; immutable in-memory route snapshots replace disk
capture and reject undeclared worker routes.

## [0.14.0](https://github.com/mokly-ai/mokly/compare/v0.13.0...v0.14.0) (2026-10-08)


### ⚠ BREAKING CHANGES

* **publish:** mokly publish now requires a clean checkout. Commit, stash or ignore uncommitted files before publishing. There is no override flag.
* Use mokly-viewer/ and generations/, ownership v3 and upload v2. Older services reject publication with the documented version error until their receiver and viewer are updated.
* file-path identity and Markdown documents ([#131](https://github.com/mokly-ai/mokly/issues/131))
* Path identity removes id, navPath, entries and entriesDir. Use roots and file-derived paths. Rebuild manifest v8 and consume read model v4, review result v5, disclosure storage v4 and /view/<path>/ URLs. Earlier formats, URLs, ids, disclosure keys and configuration are not read or translated. The release note documents manual migration only.

### Features

* **cache:** make .mokly-cache ignore itself ([#145](https://github.com/mokly-ai/mokly/issues/145)) ([43ae07b](https://github.com/mokly-ai/mokly/commit/43ae07b6b25ee8af5805430e43ca70f4f20dcff3))
* **deps:** baseline-relative audit and daily update PRs ([#157](https://github.com/mokly-ai/mokly/issues/157)) ([6bb6421](https://github.com/mokly-ai/mokly/commit/6bb642193bd6d3fce4a304ab9a8eab25ff85a3d2))
* file-path identity and Markdown documents ([#131](https://github.com/mokly-ai/mokly/issues/131)) ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))
* **publish:** require a clean checkout ([#168](https://github.com/mokly-ai/mokly/issues/168)) ([acac1c7](https://github.com/mokly-ai/mokly/commit/acac1c73b9f3379ef14338485c3dccfa074b7b1c))
* simplify generated output and delivery ([#156](https://github.com/mokly-ai/mokly/issues/156)) ([b39d89a](https://github.com/mokly-ai/mokly/commit/b39d89a48b4013c331ac0d20072b1ffb9136c1af))
* tier MockLink asChild placement and add build warnings ([#124](https://github.com/mokly-ai/mokly/issues/124)) ([f66c274](https://github.com/mokly-ai/mokly/commit/f66c274d0098ce3c67ff933b043a2cc38661b91e))
* **viewer:** add route-scoped shell bootstraps ([#120](https://github.com/mokly-ai/mokly/issues/120)) ([b2c82c1](https://github.com/mokly-ai/mokly/commit/b2c82c1591c91f2550a66c464833b1f864bdab07))
* **xtask:** run the complete gate on Blacksmith Testboxes ([#160](https://github.com/mokly-ai/mokly/issues/160)) ([fcc5059](https://github.com/mokly-ai/mokly/commit/fcc50591dd1a8d6d3b85c9c3c8160a6a4270294e))


### Bug Fixes

* **build:** ignore source maps in CSS Modules ([#144](https://github.com/mokly-ai/mokly/issues/144)) ([f8ab241](https://github.com/mokly-ai/mokly/commit/f8ab241ff646662b1eb588f0d8ea42331784da24))
* **build:** keep lock directories on release ([#132](https://github.com/mokly-ai/mokly/issues/132)) ([781da7a](https://github.com/mokly-ai/mokly/commit/781da7ae3261e6694a5ef5608a91f3e34061f6d0))
* **ci:** publish npm releases from GitHub runners ([#126](https://github.com/mokly-ai/mokly/issues/126)) ([b4a02a3](https://github.com/mokly-ai/mokly/commit/b4a02a3014732d6488bdd2f1c33a0efff6421520))
* **deps:** add expiring braces audit exception ([#130](https://github.com/mokly-ai/mokly/issues/130)) ([1dc9158](https://github.com/mokly-ai/mokly/commit/1dc91580c750020d8badad81c89987b06c447efa))
* **deps:** apply in-range dependency updates ([#146](https://github.com/mokly-ai/mokly/issues/146)) ([f1ab129](https://github.com/mokly-ai/mokly/commit/f1ab12923fdcc848d7f87c5694aa2fdb88d28d5f))
* **deps:** patch source-map-js advisory ([#140](https://github.com/mokly-ai/mokly/issues/140)) ([ad2b3ec](https://github.com/mokly-ai/mokly/commit/ad2b3ece65205f45e4aab4c70106dc60c8c95563))
* **export:** read only specifiers in scripts ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))
* prevent output write and frame usage races ([#129](https://github.com/mokly-ai/mokly/issues/129)) ([800fe9f](https://github.com/mokly-ai/mokly/commit/800fe9f88a0173429b25baa1bcf41ed9e59b2256))
* **server:** keep the checked closure on reload ([#172](https://github.com/mokly-ai/mokly/issues/172)) ([eea44b6](https://github.com/mokly-ai/mokly/commit/eea44b6b4ccb722270a1227244b225b49309da06))
* **viewer:** keep stacked narrow frames reachable ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))
* **xtask:** close Testbox SSH before cleanup to end boxes promptly ([#177](https://github.com/mokly-ai/mokly/issues/177)) ([3a7be25](https://github.com/mokly-ai/mokly/commit/3a7be25aad57184ad6e62e7466210f9959e1533e))
* **xtask:** resolve remote verification review findings 4 to 14 ([#164](https://github.com/mokly-ai/mokly/issues/164)) ([3ce2fb5](https://github.com/mokly-ai/mokly/commit/3ce2fb554ede6448a9940222ad1ea01e93b1bdd5))


### Performance Improvements

* **test:** run more tests in parallel locally ([#148](https://github.com/mokly-ai/mokly/issues/148)) ([6bf6251](https://github.com/mokly-ai/mokly/commit/6bf6251791dc3c02e9c3190a10c0167db156173e))


### Documentation

* present moves in the guides and contracts ([c4138a0](https://github.com/mokly-ai/mokly/commit/c4138a0b9578448d81ce2a2868bd7ec47f5a88c6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @mokly/viewer bumped from 0.4.0 to 0.5.0

### Upgrade Notes

#### Publish Checkout

`mokly publish` requires a clean checkout before export and before upload.
Commit, stash or ignore uncommitted files. Git-ignored files, this run's `--out`
directory, and Mokly caches and temporary files are excluded. Committed generated
files must match the build; rebuild and commit them when stale. Derived output
must be ignored by Git. Failures use `git-uncommitted` or `build-stale`.
`--no-changes` still needs a committed HEAD but needs no comparison history.
See the [upload contract](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-upload.md). Local export and repository preview
capture keep their existing checkout rules.

#### Removed Options

The current API has no document transformation bridge. Remove
`MoklyConfig.compatibility` and `compatibility.transformer`. The
`CompatibilityConfig`, `CompatibilityTransformer` and
`CompatibilityTransformInput` exports are removed from `@mokly/mokly`.
Render portable HTML and links directly in entries or the configured renderer.
Supplying `compatibility`, including `undefined`, fails with
`compatibility was removed; author portable links directly`.

Catalogue v6 has one fixed layout. The branch-only `generatedPathPrefix`,
`GeneratedPathPrefix`, `FrameMount.generatedPathPrefix` and `FrameMount.route`
never shipped and have no migration API. `currentDocumentPath(route)` and
`currentDocumentRoute(pathname)` use `GENERATED_DIRECTORY` directly. The
catalogue schema version is 6. No DOM prefix override is supported.

Export directories require the current v3 ownership marker or must be empty.
There is no preview-marker migration. Baseline caches accept only complete v10
output and rebuild invalid entries. Only the current generated notice is
nonmaterial; its LF and CRLF forms remain accepted. Format version rejection,
removed-key errors and the service's 426 handling remain unchanged.

Stored `BrowseRecoveryState` requires `changesStatus` and
`filterBaselineDisclosures`; missing values discard that stored snapshot.
General shell snapshots keep their optional live status. Removed records require
`snapshotId` for any non-null `comparisonUrl`. Serve's local comparison endpoint
is not a public catalogue pointer; published pointers retain the generation-only
allowlist.

#### Portable Namespace

The viewer namespace is now `mokly-viewer/`, with comparison generations below
`mokly-viewer/diffs/generations/`. There is no `/__mokly/` alias. Generated HTML,
CSS, assets and the private manifest share `<mockupsDir>/mokly-generated/`.
Exported current resources live under `static/mokly-generated/`, with authored
closure files beside that child under `static/`.

Readers accept source manifest v10, public catalogue v6, delivery v5 and
bootstrap v2 only. The namespace change advances ownership to v3 and upload to
v2 while retaining Plan v1 and content deltas. These supersede the intermediate
format numbers in the earlier upgrade notes below. An older receiver returns
426 with the documented service-version message; an incompatible viewer fails
before reading paths. Mokly Cloud requires the separate receiver/viewer update.
See [namespace compatibility](https://github.com/mokly-ai/mokly/blob/66e1ba6a/docs/protocol/mokly-viewer-namespace.md#compatibility-failure).

The historical notes retain coverage for earlier releases: `7aba5ec2`
(navigation paths), `d227702e` (identity), `40ab4324` (comparison baseline),
`c16926ba` (baseline and viewer host), and `52ca8548` (delta publishing).
They describe earlier upgrades, not the current API. The path identity note
supersedes their identity, navigation and format guidance.

## [0.13.0](https://github.com/mokly-ai/mokly/compare/v0.12.0...v0.13.0) (2026-09-30)


### ⚠ BREAKING CHANGES

* **publish:** `mokly publish` no longer uploads one catalogue archive; it runs the plan, blob and complete exchange documented in docs/protocol/mokly-upload.md, so receivers must implement that exchange. Export ownership markers are schema 2 with per-file SHA-256 digests and sizes; schema 1 markers are rejected, so export directories written by earlier releases must be removed before exporting again. Successful plain publish output is now `Published Mokly catalogue. <uploaded> files uploaded, <unchanged> unchanged.` or `Mokly catalogue already published for this commit.`, optionally followed by the viewer URL line.
* defineCollection, collection, and the collection types are removed; place entries with navPath or nested folder(). Generated manifests are schema v6 and the public catalogue read model is v2 (folder nodes, navPath, no collections or ancestors). Rebuild generated output after upgrading.

### Features

* add co-located entries and screen variants ([ce3da27](https://github.com/mokly-ai/mokly/commit/ce3da27f2c5d9d9c8e7fbb4faf1b9cac5b167a33))
* **design:** add the disabled and validation roles ([d4228f9](https://github.com/mokly-ai/mokly/commit/d4228f90b97b2698a1b6bed53ddbdf446d4750c8))
* **publish:** upload catalogue content deltas ([#122](https://github.com/mokly-ai/mokly/issues/122)) ([0c8245f](https://github.com/mokly-ai/mokly/commit/0c8245f8dd3d6fd9802f8d2bf9cdea43819f9a69))
* replace collections with navigation paths ([#123](https://github.com/mokly-ai/mokly/issues/123)) ([b4314fe](https://github.com/mokly-ai/mokly/commit/b4314fec74ea931862a8ab2afab69d560040396a))
* **viewer:** add Auto/Light/Dark appearance ([#96](https://github.com/mokly-ai/mokly/issues/96)) ([d4228f9](https://github.com/mokly-ai/mokly/commit/d4228f90b97b2698a1b6bed53ddbdf446d4750c8))
* **viewer:** adopt the mokly-cloud logo ([#119](https://github.com/mokly-ai/mokly/issues/119)) ([3699c56](https://github.com/mokly-ai/mokly/commit/3699c56619fd9450a001547ffc7e92b9f8536fba))
* **viewer:** align comparison pane scrolling ([#121](https://github.com/mokly-ai/mokly/issues/121)) ([d71b03b](https://github.com/mokly-ai/mokly/commit/d71b03b7dc40710ef8b187beb6a25ea7a07d6fda))


### Bug Fixes

* align screen variants and history ([#115](https://github.com/mokly-ai/mokly/issues/115)) ([2ec4d83](https://github.com/mokly-ai/mokly/commit/2ec4d837df2c2fdbd74453b5844a36bd9b4272bf))
* **ci:** align workflow tests with Blacksmith ([74043d2](https://github.com/mokly-ai/mokly/commit/74043d2ca8e45c18264b25c63882ea81e58b568d))
* **ci:** await navigation disclosure transitions ([#108](https://github.com/mokly-ai/mokly/issues/108)) ([2dac7b0](https://github.com/mokly-ai/mokly/commit/2dac7b04ab60dd3cb3729bdbb119b5d195e07ba8))
* **ci:** drain fixtures before removal ([d3d3e4c](https://github.com/mokly-ai/mokly/commit/d3d3e4ceae1241f979a540bacb5cdbbd38c75008))
* **ci:** drain fixtures before removal ([c19cccb](https://github.com/mokly-ai/mokly/commit/c19cccb969f495e0ed4dfd0798341e511640af6f))
* **ci:** enforce fixture-owned teardown ([a8e2ea4](https://github.com/mokly-ai/mokly/commit/a8e2ea4ff765be1342166c1e7a09017e9ee8972b))
* **ci:** enforce fixture-owned teardown ([a32b9f2](https://github.com/mokly-ai/mokly/commit/a32b9f292c4b2d1a7fe92b75b59c0f7ffdc45292))
* **ci:** pin release checkout action ([a59aab2](https://github.com/mokly-ai/mokly/commit/a59aab2ea8134ac1b4cc0d86ca5293aa4c50eb76))
* **ci:** prevent hydration timeouts and shutdown hangs ([47c5197](https://github.com/mokly-ai/mokly/commit/47c5197976ed65d5e89562c507e53f0bac067762))
* **ci:** resolve Node 24 once per run ([#113](https://github.com/mokly-ai/mokly/issues/113)) ([a233cbd](https://github.com/mokly-ai/mokly/commit/a233cbded960c3a753e111d9c2a46ef161fed989))
* **ci:** reuse one Node 24 version across jobs ([bbba28e](https://github.com/mokly-ai/mokly/commit/bbba28e3a61b9bc9ca650dbd1ce94e6f3449326b))
* **cli:** arm shutdown before ready output ([#106](https://github.com/mokly-ai/mokly/issues/106)) ([0216610](https://github.com/mokly-ai/mokly/commit/02166103317b312de2ecb0e1ffc63b4065136dfe))
* complete entry discovery follow-up ([#111](https://github.com/mokly-ai/mokly/issues/111)) ([5ea5258](https://github.com/mokly-ai/mokly/commit/5ea52589acb697cc375f4c2649056d257fa343f3))
* **viewer:** resolve effective views ([#112](https://github.com/mokly-ai/mokly/issues/112)) ([d665d06](https://github.com/mokly-ai/mokly/commit/d665d066388a1e21efc0016f32536909e040acdd))


### Performance Improvements

* **ci:** gate Node 24 checks on release PRs ([#114](https://github.com/mokly-ai/mokly/issues/114)) ([a8f408d](https://github.com/mokly-ai/mokly/commit/a8f408d16738e8d5461b23fdc32cd94198143038))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @mokly/viewer bumped from 0.3.0 to 0.4.0

### Upgrade Notes

#### Navigation Path Upgrade

The navigation-path upgrade removes `defineCollection`, `collection`, and their
exported types; adds per-entry `navPath` and nested `folder()` authoring; and
replaces collection edges with independent section folder trees. Consumers must
regenerate manifest v7 and adopt catalogue read model v3. Obsolete
`collection:` disclosure keys are ignored on restore.

Migrate the released `@mokly/mokly` exports as follows:

- Replace `defineCollection` and its `CollectionInput` with `defineRoot` and
  `RootInput` when authoring a tree, or put `navPath` directly on independent
  entries. Nesting now defines membership, so remove `childIds`.
- Remove `CollectionDefinition`; folders are structure, not
  `RegistryDefinition` entries, and therefore have no id, description, or
  rationale of their own.
- Replace `collection` and `NestedCollectionInput` with `folder` and
  `NestedFolderInput`. Keep `title`, `children`, and inherited metadata, but
  remove the former `id`, `description`, `rationale`, and `segment` fields;
  `title` is the navigation-path label.
- Replace `RoutedEntryInput` with `EntryInput`, omit `route`, and supply
  `navPath` only when the entry belongs below folder labels. Kind and id derive
  the document path.

#### Identity Upgrade

The identity upgrade derives paths from kind and id, removes authored `route`,
`slug`, `segment`, and root `path`, and makes component variants global entries.
The `defineComponent()` return changes from `.entry` to `.entries`; export that
parent-first array of the component and its variant entries. Consumers adopt
manifest v7, catalogue v3, review v4, and delivery v3; `/id/` URLs no longer
exist.

Migrate the released `@mokly/viewer/data` exports as follows:

- Replace `catalogueViewHref` with `viewHref`: change the arguments from
  `(route)` to `(kind, id)`. Callers pass entry identity instead of a stored
  route.
- Remove `publicPath` calls. Catalogue v3 has no public document or view path
  fields to validate; derive documents with `entryRoute` using `(kind, id)` and
  rendered views with `viewRoute` using
  `(kind, id, viewport, colorScheme)` when an artifact path is required.
- Replace `pagePreviewPath` with `pagePreviewMetadataPath` for the metadata file
  inside a comparison generation, changing the argument from the complete
  generation-prefixed path to `(id)`. Use `snapshotPagePath` with `(id)` for the
  retained page document.
- Replace `componentFragmentRoute` with `viewRoute`: change the arguments from
  `(route, variantId, viewport, colorScheme?)` to
  `("component", variantId, viewport, colorScheme?)`. The component parent's
  route is no longer an argument because every variant is an entry.
- Replace `ManifestV5` with `ManifestV7`, `ReviewResultV3` with
  `ReviewResultV4`, and `ScreenReviewV3` with `ScreenReviewV4`. The current
  types use identity and view axes instead of stored artifact routes.

Migrate the released `@mokly/viewer` root types as follows:

- Replace `CatalogueCollection` with the `kind: "folder"` branch of
  `CatalogueNode` and consume folders through `CatalogueReadModel.tree`.
  Folders are structural and no longer carry collection ids, entry metadata,
  or `childIds`.
- Replace `CatalogueRoutedEntry` with `CatalogueRecord`. The current union
  addresses catalogue records by kind and id and has no stored route.
- Replace `CatalogueVariant` with `CatalogueComponentVariant`. A component
  variant is now a complete catalogue entry with global identity, navigation
  metadata, and `variantOf` instead of a local object inside its parent.

Entry ids now reject a value that is exactly `aux`, `con`, `nul`, `prn`,
`com1` through `com9`, or `lpt1` through `lpt9`, using the case-insensitive
`isWindowsDeviceName` rule. This applies to every global entry id, including
screen and component variants, because the id becomes a filename stem; tags,
logical-link syntax, and `ReviewIgnore` ids retain the plain kebab-case grammar.
Registry preparation reports `invalid-id` with
`id must be globally unique kebab-case`; component authoring can report the
same detail, or `variant id must be globally unique kebab-case`, at its earlier
validation boundary. Rename the entry to a descriptive kebab-case id that is
not one of those reserved device names and update references to it.

The old `?variant=<id>` query is no longer a selector. The current route parser
opens the entry named by the URL pathname and ignores every `variant` query
value, so a parent URL stays on the parent rather than opening that id; the
unrecognized query can remain in the initially loaded address, but Mokly's next
generated navigation does not carry it. Link a variant as its own entry with
`viewHref(kind, variantId)`.

#### Comparison Baseline

Comparisons require a base built by this Mokly version. An earlier base makes
Changes unavailable until the base includes this version, while export and
publish still complete without Changes.

#### Delta Publishing

`mokly publish` now uses the content-addressed Plan, Blob, and Complete exchange
instead of sending one archive containing the complete exported catalogue.
Independent receivers must accept the v1 Plan archive, answer with the missing
content digests and upload URLs, verify raw Blob PUTs by digest and size, and
make Complete idempotent under the documented first-publication rule. Clients
upload only content the receiver does not already hold.

Export ownership marker schema 2 replaces schema 1. Each owned file is recorded
as `{ path, sha256, size }`, and the marker covers the exact finalized bytes that
the exchange addresses. Export folders written by earlier releases are not
recognized as owned: move any files you added, delete the old export folder,
and export again. The public `export-ownership-v1.json` compatibility fixture is
removed; receiver conformance uses `export-ownership-v2.json`.

The new `--upload-concurrency <n>` publish option controls parallel Blob PUTs.
It accepts integers from 1 through 32 and defaults to 8.

#### Viewer Host API

Viewer hosts must remove `ViewerSelection.variantId` and
`InstanceRef.variantId`; `ScreenNavigateEvent` removes `route` and `variantId`
and becomes `{ screenId, snapshotId?, fragment?, navigation? }`. Its optional
`snapshotId` is present only when the committed historical record publishes an
opaque identity.

Release notes and the close-out commit use a `BREAKING CHANGE:` footer naming
the applicable upgrades above; the release PR owns versions and changelogs.

## [0.12.0](https://github.com/mokly-ai/mokly/compare/v0.11.0...v0.12.0) (2026-09-22)


### Features

* **cli:** color rich success ticks green ([#91](https://github.com/mokly-ai/mokly/issues/91)) ([48af447](https://github.com/mokly-ai/mokly/commit/48af447ce2834bc4b03266066a2210845aab18c4))
* **cli:** improve terminal experience ([#85](https://github.com/mokly-ai/mokly/issues/85)) ([ddb263b](https://github.com/mokly-ai/mokly/commit/ddb263ba694f94484debbea73916f67226d5b1f5))
* show previous versions of removed pages and screens ([#98](https://github.com/mokly-ai/mokly/issues/98)) ([a177abd](https://github.com/mokly-ai/mokly/commit/a177abd22da825576a11c7d102232c71b7d83f32))
* **viewer:** hydrate the shared Browse shell ([#95](https://github.com/mokly-ai/mokly/issues/95)) ([b5c9f07](https://github.com/mokly-ai/mokly/commit/b5c9f07dc70290c990f9608fc0d75e58188a50b5))
* **viewer:** present removed previews as viewer-owned documents ([#104](https://github.com/mokly-ai/mokly/issues/104)) ([f23c376](https://github.com/mokly-ai/mokly/commit/f23c376966343a226a8b7e76aee32a784cf08fa4))


### Bug Fixes

* align mobile inspector surface ([#92](https://github.com/mokly-ai/mokly/issues/92)) ([310749a](https://github.com/mokly-ai/mokly/commit/310749aa2b715638ee95bf610657f45ef949f463))
* **release:** extend registry retry window ([#86](https://github.com/mokly-ai/mokly/issues/86)) ([8c4701f](https://github.com/mokly-ai/mokly/commit/8c4701f7bc26347d0b061cf4e78e0e2ef0e400a0))
* **shell:** match inspector divider to nav divider ([#90](https://github.com/mokly-ai/mokly/issues/90)) ([9bd6f20](https://github.com/mokly-ai/mokly/commit/9bd6f20ab10cc8fb403de68359de59dd82d94141))
* **viewer:** authenticate frame document handoffs ([#99](https://github.com/mokly-ai/mokly/issues/99)) ([b95ad47](https://github.com/mokly-ai/mokly/commit/b95ad472c04768e777bc8f2d3b0555380f0e8f61))
* **viewer:** repair embedded stylesheet layout ([#103](https://github.com/mokly-ai/mokly/issues/103)) ([dde661c](https://github.com/mokly-ai/mokly/commit/dde661c7695773170e8c86ee1960bf9e4eab144c))


### Performance Improvements

* **ci:** parallelize verification suites ([#93](https://github.com/mokly-ai/mokly/issues/93)) ([3f6ea42](https://github.com/mokly-ai/mokly/commit/3f6ea4265129112d7626c1fc16e6d100b33fdf4f))
* **review:** skip unchanged component view comparisons ([#94](https://github.com/mokly-ai/mokly/issues/94)) ([20e55ca](https://github.com/mokly-ai/mokly/commit/20e55ca02a7274b659031b2295bc4d3e92360767))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @mokly/viewer bumped from 0.2.0 to 0.3.0

## [0.11.0](https://github.com/mokly-ai/mokly/compare/v0.10.0...v0.11.0) (2026-09-17)


### Features

* default generated output to derived ([#81](https://github.com/mokly-ai/mokly/issues/81)) ([37a5ea8](https://github.com/mokly-ai/mokly/commit/37a5ea8919c880327e6baf88a3d9e7fa76975852))
* **docs:** ship the CLI guides in the package ([#82](https://github.com/mokly-ai/mokly/issues/82)) ([9296ee3](https://github.com/mokly-ai/mokly/commit/9296ee322b65f4fce992b464ca7da46ebcd963eb))
* **viewer:** add comment anchoring primitives ([#84](https://github.com/mokly-ai/mokly/issues/84)) ([adac9e1](https://github.com/mokly-ai/mokly/commit/adac9e1d56549a5ba164bf90508a93fd59d34e44))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @mokly/viewer bumped from 0.1.0 to 0.2.0

## [0.10.0](https://github.com/mokly-ai/mokly/compare/v0.9.0...v0.10.0) (2026-09-17)


### Features

* add @mokly/viewer embeddable viewer package ([#76](https://github.com/mokly-ai/mokly/issues/76)) ([d7b0ac3](https://github.com/mokly-ai/mokly/commit/d7b0ac356b9397caf1db4e8c88add161da8c0f1b))
* upstream the Mokabook 0.8.0 consumer patch ([#74](https://github.com/mokly-ai/mokly/issues/74)) ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))
* **xtask:** add commit-title-lint gate ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))


### Bug Fixes

* **release:** pin viewer initial version ([#78](https://github.com/mokly-ai/mokly/issues/78)) ([65feea8](https://github.com/mokly-ai/mokly/commit/65feea88c876ee79a5bd1feef16705caa66eebbc))
* **serve:** drop dead anchor guard in localHost ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))
* **serve:** surface worker render failures on the server ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))
* **serve:** validate transferred exclusions without re-prepending ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))


### Performance Improvements

* **build:** cache compiled exclusion matchers per config ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))
* **workspace:** dedupe affected usages in one pass ([7ca301c](https://github.com/mokly-ai/mokly/commit/7ca301c04ca898db6ff60b110beb213ec740b004))

## [0.9.0](https://github.com/mokly-ai/mokly/compare/v0.8.0...v0.9.0) (2026-09-15)


### ⚠ BREAKING CHANGES

* npm consumers must install and import @mokly/mokly; the unscoped name is not a package alias.
* Install and import @mokly/mokly. The unscoped name is not a package alias; the CLI remains mokly.
* rename package to Mokly ([#66](https://github.com/mokly-ai/mokly/issues/66))
* rename package to Mokly

### Features

* add CSS change attribution ([#72](https://github.com/mokly-ai/mokly/issues/72)) ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))
* add derived baseline output ([#70](https://github.com/mokly-ai/mokly/issues/70)) ([9af53be](https://github.com/mokly-ai/mokly/commit/9af53beb1dc09c3ff9381fccf4ff5bc52eafb5b5))
* **design:** add stylesheet evidence mockups ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))
* **design:** depict stylesheet evidence inside a loaded comparison ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))
* publish catalogues to upload services ([#71](https://github.com/mokly-ai/mokly/issues/71)) ([9580d74](https://github.com/mokly-ai/mokly/commit/9580d74d8b9027073099ab71abaa9dfc91a7ac5e))
* rename package to Mokly ([96a7ca6](https://github.com/mokly-ai/mokly/commit/96a7ca66ba89e24017152368e2154e75230e9f9a))
* rename package to Mokly ([#66](https://github.com/mokly-ai/mokly/issues/66)) ([f0fcfa9](https://github.com/mokly-ai/mokly/commit/f0fcfa9bbc595defd5efd3991d6deda6ef1574a1))
* **review:** add the review.css-analysis timing span ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))
* **shell:** split catalogue navigation into sections ([#60](https://github.com/mokly-ai/mokly/issues/60)) ([83b377a](https://github.com/mokly-ai/mokly/commit/83b377a54c5005f7f15800549bcc5cf4544dcda4))


### Bug Fixes

* address Mokly migration review findings ([681db1a](https://github.com/mokly-ai/mokly/commit/681db1aa2ed63dc94f5bb40b563a2a95ff526167))
* **benchmark:** expect zero Changes for an unrelated shared-rule edit ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))
* **design:** show impact screens as plain previews and fix card spacing ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))
* keep added and removed screens current-only ([#64](https://github.com/mokly-ai/mokly/issues/64)) ([9301443](https://github.com/mokly-ai/mokly/commit/93014436aea164d76c504d2d06a4edde98f5025c))
* load selected comparisons and recover expired snapshots ([#62](https://github.com/mokly-ai/mokly/issues/62)) ([b19dc62](https://github.com/mokly-ai/mokly/commit/b19dc627f78354863ddf60478f3cfa6671ffdfa2))
* pack bootstrap from the exact source tip ([aeb9a26](https://github.com/mokly-ai/mokly/commit/aeb9a26c510621dbc37b1a8a84552ec42bfa2736))
* preserve catalogue state on evidence updates ([#59](https://github.com/mokly-ai/mokly/issues/59)) ([7cefa42](https://github.com/mokly-ai/mokly/commit/7cefa427a1612458c0f9f7f40ed205aa02c12687))
* preserve Usage link focus during updates ([#63](https://github.com/mokly-ai/mokly/issues/63)) ([e0dc6d1](https://github.com/mokly-ai/mokly/commit/e0dc6d10163e79e0b991d1cd25b53778810dffe7))
* publish under the Mokly npm scope ([#67](https://github.com/mokly-ai/mokly/issues/67)) ([bf1f5be](https://github.com/mokly-ai/mokly/commit/bf1f5be35f7296a185081b0cb830e068577eb598))
* publish under the Mokly npm scope ([#69](https://github.com/mokly-ai/mokly/issues/69)) ([5b4c647](https://github.com/mokly-ai/mokly/commit/5b4c647b6138fa08d65a7573f01b1c342ec9b019))
* **review:** preserve function-name boundaries in CSS serialization ([4869b4a](https://github.com/mokly-ai/mokly/commit/4869b4a3775a615aa9f65b6038ed9522845a12b7))

## [0.8.0](https://github.com/futex-ai/mokabook/compare/v0.7.1...v0.8.0) (2026-09-11)


### ⚠ BREAKING CHANGES

* remove legacy configuration and exported types, automatic source discovery, comment-component expansion, legacy lint options and route aliases. Consumers must register document pages, preserve explicit routes, and regenerate v4 output through the documented ownership migration. The legacy renderer and raw HTML fixture are intentionally removed; shared change metadata replaces the removed-screen helper without removing screen support.

### Features

* unify catalogue pages and optional published Changes ([#54](https://github.com/futex-ai/mokabook/issues/54)) ([b5065a6](https://github.com/futex-ai/mokabook/commit/b5065a68b5ecb2f3bdc327a26659bcd6d9a3b2ff))


### Bug Fixes

* **server:** allow five-minute watched startup ([#56](https://github.com/futex-ai/mokabook/issues/56)) ([bdb2125](https://github.com/futex-ai/mokabook/commit/bdb212555fb4e01156ead1bcc1a8b38d67876925))


### Performance Improvements

* start large catalogues with on-demand previews ([#57](https://github.com/futex-ai/mokabook/issues/57)) ([aab65ab](https://github.com/futex-ai/mokabook/commit/aab65abcb7ae96e111268cf88ba890c82b0c7d2c))

## [0.7.1](https://github.com/futex-ai/mokabook/compare/v0.7.0...v0.7.1) (2026-09-11)


### Bug Fixes

* **ci:** isolate comparison test baselines ([#51](https://github.com/futex-ai/mokabook/issues/51)) ([4d1fb34](https://github.com/futex-ai/mokabook/commit/4d1fb348589255961c9ca37ee833fdcce9860c1a))

## [0.7.0](https://github.com/futex-ai/mokabook/compare/v0.6.0...v0.7.0) (2026-09-10)


### ⚠ BREAKING CHANGES

* use mokabook serve and select a screen comparison instead of invoking mokabook review or opening a standalone Review report.

### Features

* add consumer static catalogue export ([#49](https://github.com/futex-ai/mokabook/issues/49)) ([a0e349a](https://github.com/futex-ai/mokabook/commit/a0e349a06bac83a1f873d7ee4980b6504ad1cfdf))
* add MockLinks to the Mokabook catalogue ([#46](https://github.com/futex-ai/mokabook/issues/46)) ([93ac778](https://github.com/futex-ai/mokabook/commit/93ac77848993bf1757eceac9387aef485823acf2))
* adopt screen stack logo ([#44](https://github.com/futex-ai/mokabook/issues/44)) ([815405e](https://github.com/futex-ai/mokabook/commit/815405e8206f4db1ae44ef005c04b6a658bceaaa))
* move screen diffs into Changes ([#40](https://github.com/futex-ai/mokabook/issues/40)) ([b1d74a5](https://github.com/futex-ai/mokabook/commit/b1d74a5390341f8fb9a851f3e59f0cb3183e280c))
* **shell:** make navigation resizable ([#38](https://github.com/futex-ai/mokabook/issues/38)) ([b45327a](https://github.com/futex-ai/mokabook/commit/b45327a722e0f16a214005a91692709f7181d481))
* support MockLink child controls ([#42](https://github.com/futex-ai/mokabook/issues/42)) ([f11e516](https://github.com/futex-ai/mokabook/commit/f11e516d144b4616986423ccf3e8ed86095eed21))


### Bug Fixes

* **browse:** preserve collapsed groups across navigation ([#35](https://github.com/futex-ai/mokabook/issues/35)) ([ef66bf2](https://github.com/futex-ai/mokabook/commit/ef66bf219e7a846f5660f55ef6359ae0d07d5823))
* collapse details inspector by default ([#41](https://github.com/futex-ai/mokabook/issues/41)) ([9398ff6](https://github.com/futex-ai/mokabook/commit/9398ff64fb5a115a4aa3a08c910176ebd10d03a3))
* focus Changes on reviewable screen output ([#47](https://github.com/futex-ai/mokabook/issues/47)) ([a5ecbc0](https://github.com/futex-ai/mokabook/commit/a5ecbc06d6169ec4af5329d52b6f13b2cd2f0276))
* **search:** match authored page IDs ([#39](https://github.com/futex-ai/mokabook/issues/39)) ([1dcfb67](https://github.com/futex-ai/mokabook/commit/1dcfb67ce1e058051f5f1d0e76e3042ad9d40cc3))
* **shell:** draw copy and expand as legible icons ([#50](https://github.com/futex-ai/mokabook/issues/50)) ([aa5adea](https://github.com/futex-ai/mokabook/commit/aa5adea1b7d00fbfc4c3c3cf5e95c553635ccd2f))
* **shell:** replace tiny search glyph with a legible search icon ([#43](https://github.com/futex-ai/mokabook/issues/43)) ([bb3a22f](https://github.com/futex-ai/mokabook/commit/bb3a22facae6b98355c4e20effdfd47676f8fdb6))

## [0.6.0](https://github.com/futex-ai/mokabook/compare/v0.5.1...v0.6.0) (2026-08-26)


### Features

* infer breadcrumbs from hierarchy ([#29](https://github.com/futex-ai/mokabook/issues/29)) ([f8aa5fc](https://github.com/futex-ai/mokabook/commit/f8aa5fcfb129fa6602f3b88da2343200f9b64a4a))
* navigate catalogue links through Browse ([#30](https://github.com/futex-ai/mokabook/issues/30)) ([4c3fd17](https://github.com/futex-ai/mokabook/commit/4c3fd17ad4d3a2bd7b42c3c21912dd17ff7e1d14))


### Bug Fixes

* **browse:** persist details before navigation ([#32](https://github.com/futex-ai/mokabook/issues/32)) ([9292dbc](https://github.com/futex-ai/mokabook/commit/9292dbcb4b64a685ec64269d55ac0cbcd57bd483))
* ignore compatibility nav paths in Changed ([#33](https://github.com/futex-ai/mokabook/issues/33)) ([6acfa2a](https://github.com/futex-ai/mokabook/commit/6acfa2a30e4fc920a6daec06ac0a9b4929a0e58e))

## [0.5.1](https://github.com/futex-ai/mokabook/compare/v0.5.0...v0.5.1) (2026-08-11)


### Bug Fixes

* compare branch changes from merge base ([#27](https://github.com/futex-ai/mokabook/issues/27)) ([f2c7dd2](https://github.com/futex-ai/mokabook/commit/f2c7dd26062825b079310438268832324980a882))

## [0.5.0](https://github.com/futex-ai/mokabook/compare/v0.4.0...v0.5.0) (2026-08-07)


### Features

* **example:** dark fragments become readable - dark accent [#7](https://github.com/futex-ai/mokabook/issues/7)fae95 ([c92e6e5](https://github.com/futex-ai/mokabook/commit/c92e6e5d69445309eb633a43ca69c924da34a0a2))
* native light/dark color scheme support ([#26](https://github.com/futex-ai/mokabook/issues/26)) ([c92e6e5](https://github.com/futex-ai/mokabook/commit/c92e6e5d69445309eb633a43ca69c924da34a0a2))


### Bug Fixes

* **browse:** remember details disclosure ([#24](https://github.com/futex-ai/mokabook/issues/24)) ([7e12e79](https://github.com/futex-ai/mokabook/commit/7e12e79115010b62b3a19b002ba1defc8731e1f9))
* **preview:** the static snapshot now rewrites data-fragment-light ([c92e6e5](https://github.com/futex-ai/mokabook/commit/c92e6e5d69445309eb633a43ca69c924da34a0a2))

## [0.4.0](https://github.com/futex-ai/mokabook/compare/v0.3.0...v0.4.0) (2026-07-28)


### Features

* **shell:** add a phone status band ([#21](https://github.com/futex-ai/mokabook/issues/21)) ([48e8007](https://github.com/futex-ai/mokabook/commit/48e8007a31659c2a53d9e9489f5efb36f5900a6c))


### Performance Improvements

* **review:** speed large catalogue loading ([#23](https://github.com/futex-ai/mokabook/issues/23)) ([bd28247](https://github.com/futex-ai/mokabook/commit/bd28247d88405a9cfb5a94efa9d509bec444a9fd))

## [0.3.0](https://github.com/futex-ai/mokabook/compare/v0.2.0...v0.3.0) (2026-07-23)


### Features

* **review:** serve Review at /review in the shell design ([#19](https://github.com/futex-ai/mokabook/issues/19)) ([bf06cbb](https://github.com/futex-ai/mokabook/commit/bf06cbb336d435192902da9f55155c8c2504c019))


### Bug Fixes

* **release:** retry registry propagation ([#16](https://github.com/futex-ai/mokabook/issues/16)) ([c7bbf23](https://github.com/futex-ai/mokabook/commit/c7bbf23429d39f6e1d536b5c23e0e64cf8e83105))
* **review:** keep served artifacts current ([#20](https://github.com/futex-ai/mokabook/issues/20)) ([8fff547](https://github.com/futex-ai/mokabook/commit/8fff547ba05cd5ff542bb03242d7950e61b681d4))

## [0.2.0](https://github.com/futex-ai/mokabook/compare/v0.1.0...v0.2.0) (2026-07-22)


### Features

* add pull request preview deployments ([#12](https://github.com/futex-ai/mokabook/issues/12)) ([37b7dc3](https://github.com/futex-ai/mokabook/commit/37b7dc34190ab076d05f44ab4de334febafdc8df))
* move viewport switch into header ([#11](https://github.com/futex-ai/mokabook/issues/11)) ([d5ee0be](https://github.com/futex-ai/mokabook/commit/d5ee0be162f27ad41bec9e3f12bd57a374f2cff0))


### Bug Fixes

* **browse:** copy IDs without navigation ([#13](https://github.com/futex-ai/mokabook/issues/13)) ([5123150](https://github.com/futex-ai/mokabook/commit/51231500f0c40eb1c72278a7f64ce4d4843cacd7))
* **release:** install before auditing signatures ([#8](https://github.com/futex-ai/mokabook/issues/8)) ([05b95d3](https://github.com/futex-ai/mokabook/commit/05b95d33291a32288397973402e11fb63b385f7c))
* **server:** advance past occupied ports ([#15](https://github.com/futex-ai/mokabook/issues/15)) ([9e416c2](https://github.com/futex-ai/mokabook/commit/9e416c229706df8f9eb0b98876843c37513c6f24))

## 0.1.0 (2026-07-20)


### Features

* **example:** prove the consumer contract against the real Firna stack - ([2b3827e](https://github.com/futex-ai/mokabook/commit/2b3827e7572c85a82696a1cc47d8bdee2e3dc14c))
* establish an app-independent Mokabook framework ([#1](https://github.com/futex-ai/mokabook/issues/1)) ([2b3827e](https://github.com/futex-ai/mokabook/commit/2b3827e7572c85a82696a1cc47d8bdee2e3dc14c))
* rebuild the served Browse shell to the refined Mockbook design from ([2b3827e](https://github.com/futex-ai/mokabook/commit/2b3827e7572c85a82696a1cc47d8bdee2e3dc14c))

## Changelog

All notable changes to Mokabook will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- Rule-level attribution for linked stylesheet changes, with matched styles and
  examined-and-excluded evidence in Details for screen and component catalogues.
  Unrelated or formatting-only rules no longer add consumers to Changes;
  unresolved rules retain conservative impact evidence. Opt-in diagnostics
  include CSS analysis timings.
- Initial app-independent Mokabook package foundation.
- Typed config discovery and public registry/Review authoring helpers.
- Deterministic React-to-static-HTML build and non-mutating output checks.
- Manifest-backed responsive Browse server with transactional watched lifecycle.
- Git-based per-viewport Review artifacts, comparison UI, and ignore normalization.
- Packed ESM, NodeNext, clean-cache npx, themed, and Juno-shaped
  consumer verification.
- Consumer-owned module resolution, legacy exclusions, and a temporary typed
  document compatibility bridge for staged migrations.
- Minimum/release-runtime CI plus release-please and tokenless npm trusted
  publishing automation.
