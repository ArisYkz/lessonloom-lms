# Bilim — Road to Production

## Where we are now (~40% to launch)

Working end-to-end in preview: teacher signup → org → course builder → admin approval → student enrolls → learns. Three languages, free courses, new visual identity, access control via `has_course_access`, private media with signed URLs.

## Phase 1 — Launch blockers (must have)

1. **Brand & domain** — final name (replace "Bilim" placeholder), logo, custom domain, favicon/OG image.
2. **Payments (subscriptions)** — the only pricing model besides free. Options: Stripe (works now, international cards) or Freedom Pay (Kazakh cards/Kaspi — needs a merchant account and credentials from you). Checkout → webhook → subscription states (ACTIVE/PAST_DUE/etc.) → access via existing `has_course_access`.
3. **Content moderation basics** — admin can already approve/reject; add reporting/takedown and a teacher-facing "why rejected" notice.
4. **Legal pages** — Terms, Privacy Policy, Offer (публичная оферта) for paid subscriptions, in kk/ru/en.
5. **Error pages & polish** — proper 404, error states, empty states, mobile check of every page.
6. **Email** — transactional emails (welcome, enrollment, receipt) via a connected email domain.

## Phase 2 — Trust & safety (before real money/users)

7. **Security review** — run the backend security scan + linter, audit RLS policies, rate-limit auth endpoints.
8. **Teacher payouts** — how teachers get their subscription share (even manual payouts tracked in admin at first).
9. **Refund/cancellation flow** — student cancels subscription, refund policy handling.
10. **Backups & monitoring** — point-in-time recovery check, error tracking, analytics.

## Phase 3 — Growth (after first real users)

11. **Richer lessons** — video hosting/streaming (beyond file upload), attachments, lesson ordering UX.
12. **Quizzes (simple)** — only if teachers ask.
13. **Reviews/ratings** on courses.
14. **Search improvements**, category landing pages, SEO.
15. **Notifications** — new lesson published, course approved/rejected.

## Explicitly out of scope (per your PRD)

Community, live classes, certificates, SCORM, AI assistant, mobile apps, affiliates, bundles, coupons, drip, corporate LMS — only added when demand is proven.

## Technical notes

- Backend: Lovable Cloud (Postgres + auth + storage). Schema, RLS, and access functions already in place; payments add `subscriptions`/`payments` writes via webhook server routes under `/api/public/*`.
- Kazakhstan data residency is a hosting/infrastructure decision, separate from this build.
- Suggested launch order: Phase 1 items 1–5 → soft launch with free courses → payments (item 2) as soon as provider credentials are ready.
