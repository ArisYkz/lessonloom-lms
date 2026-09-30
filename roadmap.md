# Roadmap — Road to Production

Approved plan: .lovable/plan/bilim-road-to-production-revised-with-your-roadmap-2026-09-30.md

## Blocked on user decisions
- [ ] Business model (who legally sells; commission/teacher share) — needs Kazakhstan accountant/lawyer input
- [ ] Data residency (Kazakhstan-hosted DB) — launch blocker, infrastructure decision
- [ ] Final brand name/domain/logo
- [ ] Legal documents (Terms, Privacy, Public Offer, Teacher Agreement) — need real legal text
- [ ] Payments (Freedom Pay merchant account + credentials)
- [ ] Transactional email domain (SPF/DKIM/DMARC)

## Done
- [x] Reports/takedown: reports table + RLS, submit dialog on course pages, admin Reports tab (under review / resolve / dismiss + notes), audit logging
- [x] Teacher-facing rejection reason with title in course builder
- [x] 404 page verified; error + empty states present on major screens

## Later
- [ ] Audit log extension (payments, payouts, role changes)
- [ ] Basic analytics events
- [ ] Mobile QA pass
- [ ] Security review + backup/restore test

## Wave 3 — Discovery, roles, video, danmaku
- [x] Home feed (trending, new, free, teachers, categories, continue learning)
- [x] Teacher storefront (cover, photo, stats)
- [x] Student/Teacher mode switch + default mode
- [x] Teacher plans structure (Start/Pro/Academy, course and student limits, admin manual toggle)
- [x] Free video preview (per-course minutes) with paywall
- [x] Danmaku (post, realtime, colors, opacity/density, teacher hide/delete/block)
- [x] Real teacher-plan pricing — Start ₸4,990; Pro ₸12,990; Academy ₸29,990 monthly
- [ ] 480/720/1080 quality — needs video service choice (Cloudflare Stream or Mux)
- [ ] Full teacher+student test run

## Production hardening (plan: .lovable/plan/bilim-production-hardening-and-full-workflow-test-2026-09-30.md)
- [x] Profiles private (own + admin only); internal checks closed to signed-out visitors
- [x] Password reset (link on sign-in + /reset-password)
- [x] Spam limits: reports (10/h), discussion (5/min); danmaku already limited
- [x] Security rescan: only intentional public data left (school storefronts, plan prices, categories)
- [ ] Phase 2 full browser workflow test (teacher/admin/student/paid preview/permission attacks/plan limits/languages) + blank studio bug
- [ ] Phase 3 mobile pass, automated tests for core rules, SEO basics
- [ ] Phase 4 monitoring, test/live split, backup restore test, analytics
- [ ] Phase 5 blocked on user: email domain, legal text, data residency, brand, video service, Freedom Pay
