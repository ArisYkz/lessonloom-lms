alter table public.profiles
  add column show_photo_to_classmates boolean not null default true;

drop function public.list_public_classrooms(integer);

create function public.list_public_classrooms(_limit integer default 50)
returns table(classroom_id uuid, classroom_name text, course_id uuid, course_slug text, course_title text)
language sql
stable
security definer
set search_path = public
as $$
  select cl.id, cl.name, cl.course_id, c.slug, c.title
  from public.classrooms cl
  join public.courses c on c.id = cl.course_id
  where cl.listed and cl.status = 'active' and c.status = 'published'
  order by cl.created_at desc
  limit least(greatest(_limit, 1), 100)
$$;

grant execute on function public.list_public_classrooms(integer) to anon, authenticated;

create function public.list_my_classes()
returns table(
  classroom_id uuid,
  classroom_name text,
  course_id uuid,
  course_slug text,
  course_title text,
  teacher_name text,
  joined_at timestamptz,
  members jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select cl.id, cl.name, cl.course_id, c.slug, c.title, o.name, me.joined_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'avatarPath', case when p.show_photo_to_classmates then p.avatar_url end
        )
        order by m.joined_at
      )
      from public.classroom_memberships m
      join public.profiles p on p.id = m.user_id
      where m.classroom_id = cl.id and m.status = 'active'
    ), '[]'::jsonb)
  from public.classroom_memberships me
  join public.classrooms cl on cl.id = me.classroom_id
  join public.courses c on c.id = cl.course_id
  join public.organizations o on o.id = cl.organization_id
  where me.user_id = auth.uid() and me.status = 'active' and cl.status = 'active'
  order by me.joined_at desc
$$;

revoke all on function public.list_my_classes() from public, anon;
grant execute on function public.list_my_classes() to authenticated;

create function public.owned_org_learner_count(_org uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case when public.owns_org(_org)
    then public.org_learner_count(_org, '00000000-0000-0000-0000-000000000000')
  end
$$;

revoke all on function public.owned_org_learner_count(uuid) from public, anon;
grant execute on function public.owned_org_learner_count(uuid) to authenticated;
