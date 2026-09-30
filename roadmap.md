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
- [x] Teacher plans structure (Starter/Pro, course limit, admin manual toggle)
- [x] Free video preview (per-course minutes) with paywall
- [x] Danmaku (post, realtime, colors, opacity/density, teacher hide/delete/block)
- [ ] Real teacher-plan pricing — needs user's plan names/prices
- [ ] 480/720/1080 quality — needs video service choice (Cloudflare Stream or Mux)
- [ ] Full teacher+student test run
