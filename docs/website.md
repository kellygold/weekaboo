# Weekaboo static website

Updated 12 September 2026. **The website is public at https://weekaboo.app/ on GitHub Pages.** Kelly authorized publication and updated the domain DNS. Public contact is `hello@weekaboo.app`, backed by the owner-confirmed ImprovMX catch-all. The site uses the existing Weekaboo brand and approved mascot/audio, fictional calendar plans, and platform-specific download slots. It is separate from the application runtime.

## Develop and review

```sh
npm run site:build
npm run site:preview
# http://127.0.0.1:5190
```

Only Node built-ins are needed to build. Preview uses Python's local HTTP server. All distributable files are in ignored `dist-site/`; upload that directory only. The build explicitly copies the public landing, legal and attribution pages, CSS/JS, two mascot SVGs, Nunito and its OFL notice, and the thirteen approved MP3s from `src/mascotSounds.ts`. Audio loads on interaction, never autoplay. No app database, credentials, env files, signing material, binaries or rejected audio candidates are copied. The output is roughly 640 KB, including all sound variants.

- `website/index.html`: landing page, fictional interactive calendar/task preview, platform availability.
- `website/site.css`: shared responsive styling and reduced-motion treatment.
- `website/site.js`: preview views, sample tasks, mascot replay, public link configuration.
- `website/privacy.html`, `credits.html`: website privacy and asset attribution. App store disclosures still need a release-specific review; this page does not certify store-policy compliance.
- `website/site.config.json`: domain, public source URL and per-platform download URLs. Empty URLs hide the action; there are no dead download buttons. Only approved HTTPS URLs should be added. This file is public, never secret.
- `scripts/build-site.mjs`: reproducible, dependency-free, allowlisted static build; relative paths support both a custom domain and a GitHub project subpath.

The interactive calendar is a lightweight illustration, not an embedded signed-in app or a real provider demo. Sample checkbox changes are discarded on reload. There is no analytics, signup form, remote font, API service or task persistence on this site.

## Validation

```sh
npm run site:build
npx playwright install chromium webkit # one-time browser setup if needed
node scripts/verify-site.mjs
```

The verifier serves the built artifact under `/weekaboo/`, exercises Chromium and WebKit at 1440, 768, 390 and 320 CSS px, checks views/tasks/mascot audio/navigation/reduced motion, rejects failed asset loads or third-party requests, and checks horizontal page overflow. Evidence/screenshots are private ignored artifacts under `output/site-validation/`. It does not sign into providers or touch app data. Real phone/device website review and deployed-domain verification remain distinct from these browser checks.

## Publication and maintenance

The reviewed source is public at [kellygold/weekaboo](https://github.com/kellygold/weekaboo). The first site deployment used `e679c61`: [successful workflow run](https://github.com/kellygold/weekaboo/actions/runs/34656414160). The public build contains only the allowlisted `dist-site` files, never app credentials, local databases, private evidence or native binaries.

`.github/workflows/website.yml` is the single active workflow. It uses manual dispatch, pinned action revisions, a main-only build and deployment environment, read-only build permissions and separate Pages/OIDC deployment permissions. Checkout does not retain its token. Source pushes do not automatically deploy the site.

To publish a reviewed website change:

1. Build and run the eight browser checks below; review changed copy/assets and destinations.
2. Audit source/history, then push the reviewed commit to `main`.
3. Run `gh workflow run website.yml --repo kellygold/weekaboo --ref main` and verify the successful run's commit.
4. Verify the live HTTPS pages, files, contact/source links, redirects and small-screen interactions. Keep unavailable download URLs empty. Native release links need separately approved, actually available artifacts.

GitHub Pages is configured for the custom domain `weekaboo.app` and HTTPS enforcement. Kelly's Squarespace DNS has these records:

| Type | Host | Value |
| --- | --- | --- |
| A | @ | `185.199.108.153` |
| A | @ | `185.199.109.153` |
| A | @ | `185.199.110.153` |
| A | @ | `185.199.111.153` |
| CNAME | www | `kellygold.github.io` |

Authoritative DNS, a public resolver and later the Mac resolver agree. Existing ImprovMX MX/SPF records were preserved. Catch-all delivery is owner-confirmed; no test email was sent by the agent. Google Search Console ownership is a separate pending verification step, not implied by correct DNS.

First public proof: all 28 site files match the local build by SHA-256, all eight Chromium/WebKit viewport/interaction checks pass against the real HTTPS origin without a DNS override, HTTP redirects to HTTPS, and the policy URLs without trailing slashes redirect correctly. Private `.env`, output and source paths return404. The earlier file-hash check used a verified GitHub IP override while the Mac cached negative DNS; this limitation does not apply to the later browser proof. Evidence: ignored `output/website-publication/`.

The first certificate covered the apex only. After `www` propagated, the existing custom-domain binding was removed and immediately restored using GitHub's documented reprovisioning procedure. Check its final certificate/redirect result before claiming `www` is verified. Never disable TLS verification as an acceptance workaround.

A scoped independent review identified an explicit Pages read-permission omission before the first dispatch. That omission was fixed; the delta review returned no blocking findings. No failed deployment of the original version was reproduced. Source/history audits reported zero secret findings before the public push. This review covers the website publication delta, not whole-app readiness.

Public repositories can use GitHub Pages on GitHub Free. This static design needs no paid runtime. Sources: [custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [custom-domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [certificate troubleshooting](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages).

## Design and attribution history

The following records explain prior design decisions; their old local-only publication status is superseded above.

## Review revision — 11 September 2026

Kelly requested finished-product language, prominent privacy, undated tasks with optional scheduling, calendar groups/context switching and bidirectional sync. Hero now leads with “Your week. Your space. Your business.”; removed development/testing qualifications from public copy. Actual publication/readiness gates remain in engineering docs. Empty configured download/source URLs produce no action rather than dead links. Site remains unpublished.

Icons: Google Calendar artwork is served locally from Google's brand resource center, alongside its full product name in the compatibility strip. Official Android robot served locally with required CC BY attribution in Credits. Lucide ISC device/cloud/calendar icons replace glyph placeholders for iPhone/iPad/Mac/Outlook/iCloud; these are illustrative icons, not unlicensed vendor logos. No store badges without real listings.

Primary sources checked 11 September 2026:
- https://partnermarketinghub.withgoogle.com/brands/google/use-cases/product-co-branding/ (compatibility product icons with context)
- https://developer.android.com/distribute/marketing-tools/brand-guidelines (robot artwork and attribution)
- https://www.apple.com/legal/intellectual-property/guidelinesfor3rdparties.html (Apple graphic marks require permission)
- https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks (graphic marks/product icon permissions)

Artwork source URLs: `https://developer.android.com/static/images/brand/android-head_flat.svg` and Calendar asset linked from `https://about.google/brand-resource-center/products-and-services/`. Preserve unmodified artwork and Credits when publishing. Public marketing approval requirements still need final review; local preview is not public release approval.

## Free and open-source revision — 11 September 2026

Hero/metadata now lead with free and open-source privacy. The source section explains code inspection. Eight viewport/browser checks passed locally. GitHub destination is authorized but not yet live; keep the link unset until creation succeeds. Source publication is separate from deploying this site. The repository is now public; final link validation is recorded in the release checklist.

## Public source connected — 11 September 2026

The repository is live at https://github.com/kellygold/weekaboo. Navigation and the source section both use that configured URL. Eight Chromium/WebKit/layout checks pass with link destination assertions. No Pages deployment or domain changes were performed; local preview remains available on port 5190.
