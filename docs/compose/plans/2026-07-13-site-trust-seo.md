# Site Trust and SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every public iMediaSave page discoverable, legally transparent, and consistently branded with complete local platform icons.

**Architecture:** A shared SEO helper will generate canonical, Open Graph, X card, and robots metadata from `PUBLIC_APP_URL`. Shared legal-notice and footer components will place responsible-use language and trust-page links across the site, while dedicated TanStack routes provide full Privacy Policy, Disclaimer, sitemap, and robots responses. Platform metadata remains the single source of truth for local SVG icon paths.

**Tech Stack:** TanStack Start file routes, React 19, TypeScript, Bun tests, Tailwind CSS, local Simple Icons SVG assets.

---

### Task 1: Regression coverage

**Files:**
- Create: `web/src/lib/siteTrustSeo.test.ts`

- [ ] Write tests requiring canonical/social metadata, complete icon paths, legal pages, shared legal UI, sitemap entries, and robots discovery.
- [ ] Run `bun test web/src/lib/siteTrustSeo.test.ts` and confirm failures identify the missing features.

### Task 2: Shared SEO foundation

**Files:**
- Create: `web/src/lib/site.ts`
- Create: `web/src/lib/seo.ts`
- Modify: `web/src/routes/__root.tsx`
- Modify: `web/src/routes/index.tsx`
- Modify: `web/src/routes/downloader.tsx`
- Modify: `web/src/routes/docs.api.tsx`
- Modify: `web/src/routes/blog.index.tsx`
- Modify: `web/src/routes/blog.$slug.tsx`

- [ ] Add normalized public URL, canonical URL, social-image URL, common metadata, and JSON-LD helpers.
- [ ] Give each indexable route a unique title, description, canonical link, Open Graph metadata, X card metadata, and structured data where relevant.
- [ ] Mark article-not-found metadata as `noindex`.

### Task 3: Privacy, disclaimer, and shared legal UI

**Files:**
- Create: `web/src/components/LegalNotice.tsx`
- Replace: `web/src/components/SiteFooter.tsx`
- Create: `web/src/routes/privacy.tsx`
- Create: `web/src/routes/disclaimer.tsx`
- Modify: `web/src/routes/__root.tsx`
- Modify: `web/src/routes/docs.api.tsx`
- Modify: `web/src/routes/blog.$slug.tsx`
- Modify: `web/src/routes/index.tsx`
- Modify: `web/src/routes/downloader.tsx`

- [ ] Add clear privacy content covering submitted URLs, media processing, technical logs, cookies, third parties, retention, security, children, user choices, and policy updates without claiming certified legal compliance.
- [ ] Add responsible-use, copyright, trademark, non-affiliation, availability, API, and no-warranty disclaimer content.
- [ ] Place a compact site-wide notice/footer in the root layout and stronger contextual notices in the downloader, API docs, and full articles.
- [ ] Remove duplicate page footers and inaccurate absolute claims such as `No data stored`.

### Task 4: Local platform icon coverage

**Files:**
- Add: `web/public/platform-logos/*.svg`
- Modify: `web/src/lib/platforms.ts`
- Modify: `web/src/routes/index.tsx`
- Modify: `web/src/routes/downloader.tsx`

- [ ] Add local Simple Icons SVG files for each supported brand, including X.
- [ ] Assign every platform an `iconPath`, retain accessible text labels, and remove generic letter/icon fallbacks from normal rendering.
- [ ] Include trademark ownership and non-endorsement language in the Disclaimer.

### Task 5: Crawl discovery and verification

**Files:**
- Create: `web/src/routes/sitemap[.]xml.ts`
- Create: `web/src/routes/robots[.]txt.ts`
- Modify: `web/src/routeTree.gen.ts` through the TanStack route generator

- [ ] Return XML containing Home, Downloader, API Docs, Blog, Privacy, Disclaimer, and every article URL.
- [ ] Return robots directives allowing public crawling and pointing to the sitemap.
- [ ] Run focused tests, all Bun tests, TypeScript checking, linting, and a production build; report any unrelated packaging limitation separately.
