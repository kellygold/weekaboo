# Weekaboo static website

Local implementation, 11 September 2026. **Website not deployed; source is public.** Kelly requested a custom static site for GitHub, alongside physical iPad validation. The site uses the existing Weekaboo brand and approved mascot/audio, fictional calendar plans, and platform-specific download slots. It is separate from the application runtime.

## Develop and review

```sh
npm run site:build
npm run site:preview
# http://127.0.0.1:5190
```

Only Node built-ins are needed to build. Preview uses Python's local HTTP server. All distributable files are in ignored `dist-site/`; upload that directory only. The build explicitly copies the three public pages, CSS/JS, two mascot SVGs, Nunito and its OFL notice, and the thirteen approved MP3s from `src/mascotSounds.ts`. Audio loads on interaction, never autoplay. No app database, credentials, env files, signing material, binaries or rejected audio candidates are copied. The output is roughly 640 KB, including all sound variants.

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

## Publication handoff — source approved, site deployment separate

The reviewed source is public at [kellygold/weekaboo](https://github.com/kellygold/weekaboo). The source URL is configured in the local website build. Exact binary download destinations remain unknown. Do not invent them or publish the whole working tree: this checkout contains private ignored state and ongoing application work.

1. Complete the authorized source publication at `kellygold/weekaboo` using the release checklist and reviewed file manifest. Set the real source URL in `website/site.config.json`. Keep unavailable downloads empty.
2. Check the static copy, credits and privacy note, including asset distribution rights. Keep download destinations truthful; no released/production-ready claim until the native validation gates pass.
3. When publication is explicitly approved, copy `website/github-pages.yml.example` into `.github/workflows/website.yml`. It is intentionally inactive today and uses **manual dispatch only**, not push-triggered publication. It uploads `dist-site` exclusively and does not need an npm install or app secrets.
4. In repository Settings → Pages, choose GitHub Actions. Configure `weekaboo.app` as the custom domain there; an Actions deployment does not rely on `CNAME` alone. Review domain verification and DNS before changes. Preserve the existing ImprovMX MX/SPF records for email.
5. Manually run the workflow, confirm HTTPS, then verify the deployed pages, assets and domain. Keep any required environment approval protection in place. No publish action has been performed in this task.
6. Add approved signed-download/TestFlight/store links when those artifacts actually exist publicly, then review and publish the change. Recheck download actions and privacy text at that point.

Public repositories can use GitHub Pages on GitHub Free. This static design needs no paid runtime. Official workflow reference checked 11 September 2026: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), including checkout v6, configure-pages v5, upload-pages-artifact v4 and deploy-pages v4. [Publishing source and custom-domain behavior](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

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
