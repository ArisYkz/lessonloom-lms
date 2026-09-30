# Course Platform — MVP walking skeleton

A Kazakhstan-first platform where teachers publish courses and students learn from them. This first build covers the whole journey end to end with free courses only, in Kazakh, Russian and English.

## The journey it delivers

```text
Teacher signs up -> creates course -> adds sections & lessons
      -> submits for review -> admin approves -> course goes live
Student signs up -> browses catalog -> opens course page
      -> enrolls free -> watches lessons -> progress is saved
```

## What gets built

**Public pages**
- Home: hero, featured courses, categories, "become a teacher" call to action
- Catalog with search, category / language / level filters
- Course page: description, curriculum outline, teacher info, enroll button
- Teacher profile page

**Accounts**
- Email + password sign up and sign in, plus Google sign-in
- One account can be student, teacher and admin at once (roles kept separate from profiles)
- Profile page with name, photo, bio, preferred language

**Teacher area**
- Dashboard: courses, students enrolled, simple stats
- Course builder in steps: basics -> curriculum -> pricing -> preview -> publish
- Sections and lessons with drag-to-reorder
- Lesson types: video, text, downloadable file
- Video and file upload to platform storage
- Draft / pending review / published / rejected states
- Student list per course with progress

**Student area**
- My courses with progress bars
- Course player: lesson sidebar, video or text body, mark complete, next lesson
- Progress saved per lesson and rolled up per course

**Admin area**
- Course review queue: approve / reject with a reason
- User list with suspend, role grants
- Category management

**Languages**
- Kazakh, Russian, English switcher in the header, choice remembered
- All interface text translated; course content stays in the language the teacher wrote it in, shown as a badge and usable as a filter

## Pricing and payments

Courses can be marked Free or Monthly subscription, and a monthly price in ₸ can be set and shown. Only free enrollment actually works in this build; a subscription course shows "Coming soon" on its button. The subscription records, states and access rules are built so a Kazakh payment provider can be wired in later without reworking the rest.

Note: local providers such as Freedom Pay cannot be connected from here, and the data-residency requirement in the document is an infrastructure decision outside this build — worth raising with your hosting choice before launch.

## Technical notes

- Lovable Cloud backend (Postgres, auth, storage, server functions) instead of the separate Nest/Next stack in the document; same data model, fewer moving parts.
- Tables: `profiles`, `user_roles`, `organizations`, `courses`, `sections`, `lessons`, `enrollments`, `lesson_progress`, `subscriptions`, `categories`, `payments` (stub), `audit_log`. Courses hang off `organization_id`, not a raw teacher id, so staff/multi-user teacher accounts can come later.
- Row-level security everywhere: drafts readable only by their organization and admins, published courses readable by anyone, lesson bodies and video URLs served only to enrolled students, roles checked through a security-definer function.
- Access decided server-side by a single `has_course_access` rule (free enrollment OR active subscription within period) that both the player and the lesson fetchers use.
- Subscription states modelled as `ACTIVE / PAST_DUE / CANCELLED / EXPIRED / PAYMENT_FAILED` from the start; a provider interface sits behind them with no live implementation yet.
- Media uploads go to storage buckets with signed URLs; lesson video links are never exposed on public course pages.
- Translations in JSON dictionaries per locale with a small provider; SEO metadata per public route.

## Build order

1. Design direction, design tokens, layout shell, language switcher
2. Backend: schema, roles, policies, storage buckets
3. Auth and profiles
4. Teacher course builder and publishing
5. Public catalog and course pages
6. Enrollment, course player, progress
7. Admin review and moderation
8. Translations pass and polish
