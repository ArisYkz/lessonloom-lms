-- ENUMS
create type public.app_role as enum ('student','teacher','admin');
create type public.course_status as enum ('draft','pending_review','published','rejected','archived');
create type public.price_model as enum ('free','subscription');
create type public.lesson_type as enum ('video','text','file');
create type public.subscription_status as enum ('ACTIVE','PAST_DUE','CANCELLED','EXPIRED','PAYMENT_FAILED');
create type public.course_level as enum ('beginner','intermediate','advanced');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  bio text,
  preferred_locale text not null default 'ru',
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles are public" on public.profiles for select using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "read own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

-- ORGANIZATIONS (teacher accounts)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  headline text,
  about text,
  logo_url text,
  created_at timestamptz not null default now()
);
create index on public.organizations(owner_id);
grant select on public.organizations to anon, authenticated;
grant insert, update on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;
create policy "orgs public read" on public.organizations for select using (true);
create policy "own org insert" on public.organizations for insert to authenticated with check (auth.uid() = owner_id);
create policy "own org update" on public.organizations for update to authenticated
  using (auth.uid() = owner_id or public.has_role(auth.uid(),'admin'));

create or replace function public.owns_org(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organizations o where o.id = _org and o.owner_id = auth.uid())
$$;

-- CATEGORIES
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_ru text not null,
  name_kk text not null,
  position int not null default 0
);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
grant insert, update, delete on public.categories to authenticated;
alter table public.categories enable row level security;
create policy "categories public read" on public.categories for select using (true);
create policy "admins manage categories" on public.categories for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- COURSES
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null unique,
  title text not null,
  short_description text not null default '',
  description text not null default '',
  thumbnail_url text,
  category_id uuid references public.categories(id) on delete set null,
  level course_level not null default 'beginner',
  language text not null default 'ru',
  price_model price_model not null default 'free',
  price_kzt integer not null default 0,
  status course_status not null default 'draft',
  rejection_reason text,
  estimated_minutes integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.courses(organization_id);
create index on public.courses(status);
grant select on public.courses to anon, authenticated;
grant insert, update, delete on public.courses to authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;
create policy "published courses public" on public.courses for select using (status = 'published');
create policy "owners read own courses" on public.courses for select to authenticated
  using (public.owns_org(organization_id) or public.has_role(auth.uid(),'admin'));
create policy "owners insert courses" on public.courses for insert to authenticated
  with check (public.owns_org(organization_id));
create policy "owners update courses" on public.courses for update to authenticated
  using (public.owns_org(organization_id) or public.has_role(auth.uid(),'admin'));
create policy "owners delete courses" on public.courses for delete to authenticated
  using (public.owns_org(organization_id) or public.has_role(auth.uid(),'admin'));

create or replace function public.can_edit_course(_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.courses c join public.organizations o on o.id = c.organization_id
    where c.id = _course and (o.owner_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  )
$$;

create or replace function public.course_is_published(_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses c where c.id = _course and c.status = 'published')
$$;

-- SECTIONS
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  position int not null default 0
);
create index on public.sections(course_id);
grant select on public.sections to anon, authenticated;
grant insert, update, delete on public.sections to authenticated;
grant all on public.sections to service_role;
alter table public.sections enable row level security;
create policy "sections of published courses" on public.sections for select
  using (public.course_is_published(course_id));
create policy "owners read sections" on public.sections for select to authenticated
  using (public.can_edit_course(course_id));
create policy "owners write sections" on public.sections for all to authenticated
  using (public.can_edit_course(course_id)) with check (public.can_edit_course(course_id));

-- LESSONS
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  type lesson_type not null default 'video',
  position int not null default 0,
  duration_minutes int not null default 0,
  is_preview boolean not null default false,
  body text,
  media_path text,
  created_at timestamptz not null default now()
);
create index on public.lessons(course_id);
create index on public.lessons(section_id);
-- column-limited grant: public/lesson lists never expose body or media_path
grant select (id, section_id, course_id, title, type, position, duration_minutes, is_preview, created_at)
  on public.lessons to anon, authenticated;
grant insert, update, delete on public.lessons to authenticated;
grant all on public.lessons to service_role;
alter table public.lessons enable row level security;
create policy "lessons of published courses" on public.lessons for select
  using (public.course_is_published(course_id));
create policy "owners read lessons" on public.lessons for select to authenticated
  using (public.can_edit_course(course_id));
create policy "owners write lessons" on public.lessons for all to authenticated
  using (public.can_edit_course(course_id)) with check (public.can_edit_course(course_id));

-- ENROLLMENTS
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index on public.enrollments(course_id);
grant select, insert, delete on public.enrollments to authenticated;
grant all on public.enrollments to service_role;
alter table public.enrollments enable row level security;
create policy "own enrollments" on public.enrollments for select to authenticated
  using (auth.uid() = user_id or public.can_edit_course(course_id));
create policy "enroll self" on public.enrollments for insert to authenticated
  with check (auth.uid() = user_id and public.course_is_published(course_id));
create policy "unenroll self" on public.enrollments for delete to authenticated
  using (auth.uid() = user_id);

-- SUBSCRIPTIONS
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status subscription_status not null default 'ACTIVE',
  price_kzt integer not null default 0,
  provider text not null default 'none',
  provider_ref text,
  started_at timestamptz not null default now(),
  current_period_end timestamptz,
  cancelled_at timestamptz
);
create index on public.subscriptions(user_id);
create index on public.subscriptions(course_id);
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "own subscriptions" on public.subscriptions for select to authenticated
  using (auth.uid() = user_id or public.can_edit_course(course_id) or public.has_role(auth.uid(),'admin'));

-- PAYMENTS (ledger stub for a future Kazakh provider)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_kzt integer not null default 0,
  status text not null default 'pending',
  provider text not null default 'none',
  provider_ref text,
  created_at timestamptz not null default now()
);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "own payments" on public.payments for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

-- ACCESS RULE
create or replace function public.has_course_access(_course uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.courses c join public.organizations o on o.id = c.organization_id
            where c.id = _course and o.owner_id = _user)
    or public.has_role(_user,'admin')
    or exists (
      select 1 from public.enrollments e join public.courses c on c.id = e.course_id
      where e.course_id = _course and e.user_id = _user and c.price_model = 'free'
    )
    or exists (
      select 1 from public.subscriptions s
      where s.course_id = _course and s.user_id = _user and s.status = 'ACTIVE'
        and (s.current_period_end is null or s.current_period_end > now())
    )
$$;

-- LESSON PROGRESS
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  completed boolean not null default true,
  completed_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index on public.lesson_progress(course_id);
grant select, insert, update, delete on public.lesson_progress to authenticated;
grant all on public.lesson_progress to service_role;
alter table public.lesson_progress enable row level security;
create policy "own progress read" on public.lesson_progress for select to authenticated
  using (auth.uid() = user_id or public.can_edit_course(course_id));
create policy "own progress write" on public.lesson_progress for insert to authenticated
  with check (auth.uid() = user_id and public.has_course_access(course_id, auth.uid()));
create policy "own progress update" on public.lesson_progress for update to authenticated
  using (auth.uid() = user_id);
create policy "own progress delete" on public.lesson_progress for delete to authenticated
  using (auth.uid() = user_id);

-- AUDIT LOG
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target_type text,
  target_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admins read audit" on public.audit_log for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- NEW USER TRIGGER
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'student')
  on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- CATEGORIES SEED
insert into public.categories (slug, name_en, name_ru, name_kk, position) values
  ('programming','Programming','Программирование','Бағдарламалау',1),
  ('languages','Languages','Языки','Тілдер',2),
  ('business','Business','Бизнес','Бизнес',3),
  ('design','Design','Дизайн','Дизайн',4),
  ('exam-prep','Exam preparation','Подготовка к экзаменам','Емтиханға дайындық',5),
  ('math-science','Math & Science','Математика и наука','Математика және ғылым',6);
