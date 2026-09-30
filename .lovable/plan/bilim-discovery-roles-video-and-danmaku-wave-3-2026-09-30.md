# Bilim — Discovery, Roles, Video and Danmaku (Wave 3)

Turns Bilim from a course library into a discovery platform. This builds on what already exists: the course builder, the lesson player, homework, quizzes, discussions, notifications and admin review.

## Phase 1 — Home feed for signed-in users (build now)
- After sign-in, people land on a new **Home feed** instead of "My learning".
- Rows on the page:
  - Continue learning (with progress)
  - Trending courses (most new enrolments in the last 14 days)
  - New courses
  - Free courses
  - Popular teachers (round photos)
  - One row per category
- Cards look like YouTube: 16:9 thumbnail, length, a Free or ₸/month badge, teacher photo and name, student count.
- "My learning" stays available in the menu.

## Phase 2 — Teacher storefront (build now)
- The teacher page gets a cover image, photo, bio, total students and course count, plus a grid of their courses.
- Clicking a teacher's name anywhere (cards, course page, player) opens this page.

## Phase 3 — Student / Teacher mode switch (build now)
- A "Student / Teacher" switch in the account menu changes the menu and where you land: Home feed or Teacher studio.
- The profile page gets a "Default mode" setting.
- Teacher mode appears once the person has a teacher account. "Become a teacher" starts setup.

## Phase 4 — Teacher platform fee (build the structure now, charging later)
- A plan for teachers that is separate from course subscriptions. Example: Starter (free, 1 course) and Pro (monthly ₸, unlimited courses).
- The fee states and limits are built now. The admin can mark a teacher as Pro by hand.
- Real charging waits for Freedom Pay credentials, as with student subscriptions.
- **Your input needed:** plan names, prices and limits.

## Phase 5 — 10-minute free preview (build now)
- Students who haven't subscribed can watch the first 10 minutes of any video lesson in a paid course. Then the player pauses and asks them to subscribe.
- The teacher can change the preview length for each course (0–30 minutes), or mark whole lessons as free, as today.
- Free courses stay fully open once a student enrols.

## Phase 6 — Danmaku (flying comments, like Bilibili) (build now)
- Signed-in students and the teacher can post short comments pinned to a moment in the video. Comments fly across the screen at that moment.
- Viewers can turn comments on or off, and change how visible and how dense they are.
- Limits: 100 characters, one comment every 5 seconds, and a basic banned-words filter.
- Teacher controls: delete a comment, block a student from commenting (per course or across all their courses), turn danmaku off per lesson, and review everything in a moderation list.
- Students can report a comment. Reports go to the existing admin Reports tab.

## Phase 7 — Video quality choice 480p / 720p / 1080p (needs a decision)
- Converting videos into several qualities needs an outside video service. The platform can't do this conversion itself.
- Options: Cloudflare Stream or Mux. Both also give real streaming and protection against downloads, which makes the 10-minute preview much harder to get around.
- Until then, videos play at their original quality and the quality menu stays hidden.
- **Your input needed:** which video service to use, and an account with it.

## Still blocked (from the production roadmap)
Business model, Kazakhstan data residency, final brand, legal documents, Freedom Pay, email domain.

## Build order
1 → 2 → 3 → 5 → 6 → 4 (structure only) → 7 (after you choose a video service). Then translations (kk/ru/en), a full test with a real teacher account and a real student account, and cleanup.

## Technical details
- **Feed:** a public `getHomeFeed` server function in catalog, with trending based on enrolments in a rolling window. Continue learning comes from learn, through the auth middleware. The new `/_authenticated/home` becomes the post-login target. Rows load with useQuery.
- **Storefront:** add `organizations.cover_url`. Extend `getTeacherBySlug` with stats.
- **Mode:** add `profiles.default_mode` ('student' | 'teacher'). The switch is client state kept in sync with the profile. It uses the existing teacher/org check.
- **Teacher plans:**
  - New `teacher_plans` table and `org_subscriptions` table (same status enum as student subscriptions, provider-agnostic).
  - A course-limit check runs in `createCourse`.
  - Admin gets a manual toggle, recorded in `audit_log`.
- **Preview:**
  - Add `courses.preview_seconds` (default 600).
  - `getLessonContent` returns `previewLimit` when `has_course_access` is false and the lesson is video. The player stops playback at the limit and shows the paywall.
  - Limitation: with raw signed files, a determined user could fetch the full file. Real protection comes with Phase 7 (signed HLS clips or a token-limited stream).
- **Danmaku:**
  - New tables:
    - `danmaku` (lesson_id, course_id, user_id, time_ms, text, color, mode scroll/top/bottom, hidden, created_at)
    - `danmaku_blocks` (org_id, course_id nullable, user_id)
  - Add `lessons.danmaku_enabled`.
  - Posting goes through a learn server function that checks access, blocks, rate limit and the word filter.
  - Moderation goes through teach functions guarded by `can_edit_course`.
  - The overlay is a lightweight DOM/CSS animation layer synced to video `timeupdate`. Supabase Realtime pushes live comments.
  - Add a `danmaku` value to `report_target_type`.
- **Video:** a provider interface (`VideoProvider`: upload URL, status webhook under `/api/public/video-webhook`, playback token) so the chosen service plugs in without touching the player.
- All new UI strings go in dictionary.ts (kk/ru/en). Access decisions stay in `has_course_access`. Project memory gets updated: danmaku, feed and teacher plans move into scope.
