-- Access and role checks answer only for the signed-in user.
-- Previously any authenticated user could pass another user's id and learn their roles or course access.
-- Signatures are unchanged, so existing policies and RPC callers keep working.

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select _user_id = auth.uid()
    and exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.has_course_access(_course uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _user = auth.uid() and (
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
  )
$$;
