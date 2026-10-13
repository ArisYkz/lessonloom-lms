<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- Courses belong to an `organization` (teacher account), never directly to a user — one teacher can own many courses and later add staff.
- All course-access decisions go through the `has_course_access` SQL function, called from server functions; the frontend never decides access.
- Course media lives in the private `course-media` bucket and is served only through short-lived signed URLs generated in `src/lib/media.server.ts`.
- Server logic lives in `src/lib/*.functions.ts` (`createServerFn`), split by audience: catalog (public), learn (student), teach (teacher), admin.
- UI strings come from `src/i18n/dictionary.ts` (kk/ru/en) via `useI18n().t` — no hardcoded user-facing text in components.
- Danmaku server logic lives in `src/lib/danmaku.functions.ts` (student posting + teacher moderation together) — one feature, both audiences, keeps the rules in one place.
- Teacher platform plans: `teacher_plans` + `org_subscriptions` per organization; course limits are enforced by the `courses_enforce_plan_limit` trigger and unique-student limits in `enroll_free_course` — keeps teacher fees separate from student course subscriptions and centralizes enforcement.
- Signed-in data fetches use POST server functions — GET responses were served stale after edits (new sections didn't appear).
