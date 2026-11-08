
create table if not exists public.artwork_like_counts (
    artwork_slug text primary key,
    like_count bigint not null default 0 check (like_count >= 0),
    updated_at timestamptz not null default now()
);

create table if not exists public.artwork_likes (
    artwork_slug text not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (artwork_slug, user_id)
);

create index if not exists artwork_likes_user_id_idx
    on public.artwork_likes(user_id);

alter table public.artwork_like_counts enable row level security;
alter table public.artwork_likes enable row level security;

-- Public visitors can read counts, but cannot write them.
revoke all on table public.artwork_like_counts from anon, authenticated;
grant select on table public.artwork_like_counts to anon, authenticated;
drop policy if exists "Anyone can read aggregate artwork likes" on public.artwork_like_counts;
create policy "Anyone can read aggregate artwork likes"
    on public.artwork_like_counts
    for select to anon, authenticated
    using (true);

-- No direct browser access to individual like rows (they contain user IDs).
revoke all on table public.artwork_likes from anon, authenticated;

create or replace function public.maintain_artwork_like_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        insert into public.artwork_like_counts (artwork_slug, like_count, updated_at)
        values (new.artwork_slug, 1, now())
        on conflict (artwork_slug) do update
            set like_count = public.artwork_like_counts.like_count + 1,
                updated_at = now();
        return new;
    elsif tg_op = 'DELETE' then
        update public.artwork_like_counts
            set like_count = greatest(like_count - 1, 0),
                updated_at = now()
            where artwork_slug = old.artwork_slug;
        return old;
    end if;
    return null;
end;
$$;

revoke all on function public.maintain_artwork_like_counts() from public, anon, authenticated;

drop trigger if exists artwork_likes_count_insert_delete on public.artwork_likes;
create trigger artwork_likes_count_insert_delete
    after insert or delete on public.artwork_likes
    for each row execute function public.maintain_artwork_like_counts();

-- Return only the current user's liked artwork slugs; never expose the user IDs.
create or replace function public.get_my_artwork_likes()
returns table (artwork_slug text)
language sql
stable
security definer
set search_path = ''
as $$
    select likes.artwork_slug
    from public.artwork_likes as likes
    where likes.user_id = (select auth.uid())
    order by likes.created_at desc;
$$;

revoke all on function public.get_my_artwork_likes() from public, anon;
grant execute on function public.get_my_artwork_likes() to authenticated;

create or replace function public.set_artwork_like(
    p_artwork_slug text,
    p_liked boolean
)
returns table (liked boolean, like_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := (select auth.uid());
    v_count bigint := 0;
begin
    if v_user_id is null then
        raise exception 'You must sign in before liking artwork.' using errcode = '42501';
    end if;

    if p_liked is null then
        raise exception 'Like state is required.' using errcode = '22023';
    end if;

    if p_artwork_slug is null
       or length(p_artwork_slug) > 100
       or p_artwork_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
        raise exception 'Invalid artwork identifier.' using errcode = '22023';
    end if;

    if p_liked then
        insert into public.artwork_likes (artwork_slug, user_id)
        values (p_artwork_slug, v_user_id)
        on conflict (artwork_slug, user_id) do nothing;
    else
        delete from public.artwork_likes
        where artwork_slug = p_artwork_slug
          and user_id = v_user_id;
    end if;

    select coalesce(counts.like_count, 0)
      into v_count
      from public.artwork_like_counts as counts
      where counts.artwork_slug = p_artwork_slug;

    return query select p_liked, coalesce(v_count, 0);
end;
$$;

revoke all on function public.set_artwork_like(text, boolean) from public, anon;
grant execute on function public.set_artwork_like(text, boolean) to authenticated;

-- Allow the public aggregate table to stream INSERT/UPDATE events via Supabase Realtime.
-- Supabase hosted projects normally already have the supabase_realtime publication.
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
           select 1 from pg_publication_tables
           where pubname = 'supabase_realtime'
             and schemaname = 'public'
             and tablename = 'artwork_like_counts'
       ) then
        alter publication supabase_realtime add table public.artwork_like_counts;
    end if;
end;
$$;
