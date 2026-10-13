-- Classrooms: a teacher's group of students on one course, joined with a code.
-- Writes go through SECURITY DEFINER functions so join codes and memberships stay server-controlled.

alter table public.courses add constraint courses_id_organization_key unique (id, organization_id);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  course_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  join_code text not null unique,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  constraint classrooms_course_organization_fkey
    foreign key (course_id, organization_id)
    references public.courses (id, organization_id) on delete cascade
);
create index on public.classrooms (course_id);

create table public.classroom_memberships (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'left', 'removed')),
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (classroom_id, user_id)
);
create index on public.classroom_memberships (user_id);

alter table public.classrooms enable row level security;
alter table public.classroom_memberships enable row level security;

-- Join codes are never readable through the table; owners fetch them via a function.
revoke all on public.classrooms from anon, authenticated;
grant select (id, organization_id, course_id, name, status, created_at) on public.classrooms to authenticated;
revoke all on public.classroom_memberships from anon, authenticated;
grant select on public.classroom_memberships to authenticated;

-- The two policies below read each other's table. These helpers read it without RLS
-- so the policies do not recurse.
create or replace function public.is_active_classroom_member(_classroom uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _user = auth.uid() and exists (
    select 1 from public.classroom_memberships m
    where m.classroom_id = _classroom and m.user_id = _user and m.status = 'active'
  )
$$;

create or replace function public.owns_classroom(_classroom uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.classrooms c
    where c.id = _classroom and public.owns_org(c.organization_id)
  )
$$;

revoke execute on function public.is_active_classroom_member(uuid, uuid) from public, anon;
revoke execute on function public.owns_classroom(uuid) from public, anon;
grant execute on function public.is_active_classroom_member(uuid, uuid) to authenticated;
grant execute on function public.owns_classroom(uuid) to authenticated;

create policy "owners read classrooms" on public.classrooms for select to authenticated
  using (public.owns_org(organization_id) or public.has_role(auth.uid(), 'admin'));

create policy "members read their classroom" on public.classrooms for select to authenticated
  using (public.is_active_classroom_member(id, auth.uid()));

create policy "read own membership" on public.classroom_memberships for select to authenticated
  using (user_id = auth.uid() or public.owns_classroom(classroom_id));
