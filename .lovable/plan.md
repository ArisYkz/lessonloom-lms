# Bilim — Road to Production (revised with your roadmap)

## Current state

Core LMS works end-to-end: teacher signup → org → course builder → admin approval → student enrolls → learns. Three languages, free courses, visual identity, `has_course_access`, private media with signed URLs. Product functionality is far along; **commercial production readiness is the real gap**.

Launch is not one event — four levels:

```text
LEVEL 1 Internal/Preview → LEVEL 2 Free Soft Launch → LEVEL 3 Paid Production → LEVEL 4 Public Growth
```

## Stage A — Production foundation (P0, decisions before anything else)

1. **Business model** — decide who legally sells the course. Recommended v1: student pays Bilim → Bilim records revenue → teacher balance → payout. Confirm legal/tax structure with a Kazakhstan accountant/lawyer. Write down: platform commission, teacher share, payout timing, refund responsibility, processing fees, chargebacks. Never leave these implicit in code.
2. **Data residency — LAUNCH BLOCKER** — Kazakhstan law requires personal data in a database located in Kazakhstan. Lovable Cloud hosts in EU/US/APAC, no Kazakhstan region. Fine for development/testing; public production requires a verified Kazakhstan-hosted arrangement. Decide now, not after paid launch.
3. **Final brand** — replace "Bilim" placeholder, logo, favicon, OG image, domain, email sender domain.
4. **Environment separation** — development / staging / production: separate database, storage, payment credentials, secrets, webhook endpoints. Never dev against production data.

**Gate: do not proceed until these are understood.**

## Stage B — Free soft launch (no real payments yet)

Invite 5–20 teachers, 20–100 students. Goal: expose bugs, confusing workflows, mobile/permission/media/moderation/email problems.

5. **Legal baseline** — Terms, Privacy Policy, Public Offer, Refund/Cancellation Policy, Teacher Agreement (content ownership, license to Bilim, prohibited content, moderation, payout rules, commission, refunds, termination, copyright, teacher tax responsibility), Content Policy. All in kk/ru/en; define which version is legally authoritative. Local legal review before paid launch.
6. **Email system** — real transactional provider/domain with SPF/DKIM/DMARC. Student: verification, welcome, enrollment, payment success/failed, subscription cancelled. Teacher: course approved/rejected, new student, payout. Admin: new submission, payment failure, reported course. All trilingual.
7. **Moderation & reporting** — rejection reason stored and shown to teacher (already stored; surface in UI). Add Report Course/Teacher/Lesson with statuses OPEN/UNDER_REVIEW/RESOLVED/DISMISSED and admin review/suspend/remove/dismiss.
8. **Error/empty/loading states** — skeletons, empty states, error + retry, proper 404 on every major screen. No blank screens.
9. **Mobile QA** — every public page on desktop/tablet/mobile.
10. **Security review** — RLS audit, SECURITY DEFINER functions, cross-teacher authorization tests (Teacher A can't touch Teacher B's course), private storage tests (unauthenticated access, access after subscription expiry), rate limiting, password reset, dependency audit + security scan. A clean scanner result ≠ validated business authorization — test both.
11. **Backups** — database + storage backup, and an actual restore test. Document RPO/RTO (start modest: 24h / 4h).
12. **Monitoring** — error tracking, server/db/uptime monitoring, alerts on API errors, webhook failures, db/storage failures, auth anomalies.
13. **Audit logs** — already have `audit_log`; extend to course approved/rejected/removed, teacher suspended, refunds, manual subscription changes, payouts, admin permission changes.
14. **Analytics** — basic funnel: course_viewed → signup_completed → course_enrolled → checkout_started → payment_succeeded/failed → lesson_started/completed → subscription_cancelled. Nothing advanced.

**Gate: real users can use the platform safely without paying.**

## Stage C — Payments (the financial core, not "just a feature")

15. **Provider** — investigate **Freedom Pay first** (documents recurring payments/profiles/auto-charges in Kazakhstan). Do not plan around Stripe — Kazakhstan is not a supported Stripe business country.
16. **Merchant account** + defined platform commission and teacher revenue model.
17. **Payment architecture** — isolated `PaymentProvider` interface → `FreedomPayProvider`; no provider-specific calls spread through the app.
18. **Data model** — extend existing `subscriptions`/`payments`; add `payment_event` (unique provider_event_id, payload, processed flag) for webhook idempotency.
19. **Subscription state machine** — PENDING → ACTIVE → PAST_DUE → (recover → ACTIVE | expire → EXPIRED); ACTIVE → CANCELLED. Never a boolean.
20. **Webhook flow** — checkout → provider → webhook → verify signature → store event → idempotency check → update payment/subscription → update access → email. The webhook is authoritative; never grant access from the checkout redirect.
21. **Access control** — `has_course_access` stays the single source of truth; add PAST_DUE grace-period rule. UI never decides payment status.
22. **Cancellation** — student keeps access until `current_period_end`; status CANCELLED.
23. **Refunds** — define window, eligibility, partial rules, admin authority, access after refund, teacher revenue reversal.
24. **Teacher revenue ledger** — immutable-style `ledger_entry` (payment_received, teacher_share, platform_share, gateway_fee, refund, refund_reversal, payout, adjustment). Never `SUM(payments)`.
25. **Manual payouts** — teacher dashboard (available/pending/paid out), admin payout requests (approve/reject/mark paid). Don't automate until the ledger is proven.
26. **Reconciliation** — admin view: gross payments, fees, refunds, platform revenue, teacher liabilities, payouts, outstanding balances. Money received = payments − refunds − fees; teacher balances = share − payouts − refund adjustments. Reconcilable independent of UI.
27. **Payment test matrix** — initial success, recurring success/failure, card expiry, cancellation, delayed/duplicated/out-of-order webhooks, refund, reversal. Define access behavior for each.

**Gate: full payment test matrix passes.**

## Stage D — Paid pilot

3–10 teachers, 10–50 paying students. Monitor payment failures, refunds, subscription state changes, teacher balances, payouts, access bugs, support questions. Run before public paid launch.

## Stage E — Public launch

Final branding, marketing, SEO (`/course/:slug`, `/teacher/:slug`, `/category/:slug`), discovery, teacher onboarding, support.

## After first real users (P2)

Video streaming (upload → transcode → streaming → CDN → secure playback), lesson improvements (drag-drop ordering, attachments, resume playback), quizzes (simple 4-option, only on teacher demand), reviews/ratings (1–5 stars, moderated, gated on meaningful consumption), notifications (email first).

## Explicitly out of scope (P3)

Community, live classes, certificates, SCORM, AI tutor, native mobile apps, affiliates, bundles, coupons, drip learning, corporate LMS, advanced automation.

## Priorities summary

- **P0 (before paid launch):** data residency, business/payment model, payment provider, subscriptions, webhook reliability, access control, refunds, teacher ledger, payouts, legal docs, security, backups, monitoring, email.
- **P1 (polished public launch):** brand, domain, SEO basics, reports/takedown, empty/error states, mobile QA, analytics, audit logs.
- **P2 (after first users):** streaming, quizzes, reviews, search, notifications.

## Key principle

Make the money flow auditable end to end before scaling teachers:

```text
Student payment → provider → Bilim transaction → subscription → course access
→ teacher liability → refund/adjustment → teacher payout
```

Free soft launch first; **no paid launch until data residency and the teacher/payment commercial model are resolved.**
