# Screenshots

Evidence that every tab and page renders against the seeded database. Captured by
`pnpm screenshots` (`scripts/screenshots.ts`) driving a real browser against a running
server — not mock-ups, and not hand-assembled.

Each was taken as the role that door belongs to, because roles are enforced server-side: a
screenshot taken as the wrong user would show a refusal rather than the screen. Product and
request ids are discovered by navigation, so re-running after a reseed just works.

27 images, 11.4 MB total, viewport 1400×900, full page.

## Regenerating

```bash
pnpm db:seed && pnpm build
PORT=3000 pnpm start &
pnpm screenshots
```

## Index

| File | Screen | Path | Signed in as |
|---|---|---|---|
| [`00-signin.png`](00-signin.png) | Sign in | `/signin` | signed out |
| [`01-marketplace.png`](01-marketplace.png) | Marketplace | `/marketplace` | Data Consumer |
| [`02-marketplace-detail.png`](02-marketplace-detail.png) | Marketplace — product detail | `/marketplace/aml-alert-triage` | Data Consumer |
| [`03-request-new.png`](03-request-new.png) | Request — intake wizard | `/request/new` | Data Consumer |
| [`04-request-mine.png`](04-request-mine.png) | Request — my requests | `/request` | Data Consumer |
| [`05-request-detail.png`](05-request-detail.png) | Request — detail and triage history | `/request/cmsb6fpfw162h7dvuw46odil7` | Data Consumer |
| [`06-my-work.png`](06-my-work.png) | My Work — approvals, reviews, tasks | `/inbox` | Domain Product Owner |
| [`07-products.png`](07-products.png) | Products | `/products` | Domain Product Owner |
| [`08-product-overview.png`](08-product-overview.png) | Lifecycle Studio — product overview | `/products/cmsb6feh310db7dvui6g1m5nu` | Domain Product Owner |
| [`09-stage-01.png`](09-stage-01.png) | Lifecycle Studio — Stage 1 | `/products/cmsb6feh310db7dvui6g1m5nu/stage/1` | Domain Product Owner |
| [`09-stage-02.png`](09-stage-02.png) | Lifecycle Studio — Stage 2 | `/products/cmsb6feh310db7dvui6g1m5nu/stage/2` | Domain Product Owner |
| [`09-stage-03.png`](09-stage-03.png) | Lifecycle Studio — Stage 3 | `/products/cmsb6feh310db7dvui6g1m5nu/stage/3` | Domain Product Owner |
| [`09-stage-04.png`](09-stage-04.png) | Lifecycle Studio — Stage 4 | `/products/cmsb6feh310db7dvui6g1m5nu/stage/4` | Domain Product Owner |
| [`09-stage-05.png`](09-stage-05.png) | Lifecycle Studio — Stage 5 | `/products/cmsb6feh310db7dvui6g1m5nu/stage/5` | Domain Product Owner |
| [`09-stage-06.png`](09-stage-06.png) | Lifecycle Studio — Stage 6 | `/products/cmsb6feh310db7dvui6g1m5nu/stage/6` | Domain Product Owner |
| [`09-stage-07.png`](09-stage-07.png) | Lifecycle Studio — Stage 7 | `/products/cmsb6feh310db7dvui6g1m5nu/stage/7` | Domain Product Owner |
| [`09-stage-08.png`](09-stage-08.png) | Lifecycle Studio — Stage 8 | `/products/cmsb6feh310db7dvui6g1m5nu/stage/8` | Domain Product Owner |
| [`09-stage-09.png`](09-stage-09.png) | Lifecycle Studio — Stage 9 | `/products/cmsb6feh310db7dvui6g1m5nu/stage/9` | Domain Product Owner |
| [`09-stage-10.png`](09-stage-10.png) | Lifecycle Studio — Stage 10 | `/products/cmsb6feh310db7dvui6g1m5nu/stage/10` | Domain Product Owner |
| [`09-stage-11.png`](09-stage-11.png) | Lifecycle Studio — Stage 11 | `/products/cmsb6feh310db7dvui6g1m5nu/stage/11` | Domain Product Owner |
| [`09-stage-12.png`](09-stage-12.png) | Lifecycle Studio — Stage 12 | `/products/cmsb6feh310db7dvui6g1m5nu/stage/12` | Domain Product Owner |
| [`10-portfolio.png`](10-portfolio.png) | Portfolio — pipeline, value, cost, maturity | `/portfolio` | Portfolio Lead / CDO |
| [`11-patterns.png`](11-patterns.png) | Consumption Patterns | `/patterns` | Admin |
| [`12-agents.png`](12-agents.png) | Agents — charters, models, external context | `/agents` | Admin |
| [`13-academy.png`](13-academy.png) | Academy — teaching layer and RACI | `/academy` | Admin |
| [`14-academy-guide.png`](14-academy-guide.png) | Academy — a guide | `/academy/stage-1` | Admin |
| [`15-admin.png`](15-admin.png) | Admin — packs, roles, controls, standards | `/admin` | Admin |
