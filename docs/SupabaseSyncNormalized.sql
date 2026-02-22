-- Supabase normalized sync schema + legacy backfill
-- Safe to run multiple times.

begin;

-- 1) Core campaign rows
create table if not exists public.rtf_campaign_core (
  campaign_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text,
  updated_by_user uuid references auth.users(id) on delete set null,
  updated_by_name text
);

create table if not exists public.rtf_campaign_hq (
  campaign_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text,
  updated_by_user uuid references auth.users(id) on delete set null,
  updated_by_name text
);

-- 2) Case rows
create table if not exists public.rtf_case_state (
  campaign_id text not null,
  case_id text not null,
  case_name text not null default 'Primary Case',
  is_active boolean not null default false,
  sort_order integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text,
  updated_by_user uuid references auth.users(id) on delete set null,
  updated_by_name text,
  primary key (campaign_id, case_id)
);

create index if not exists rtf_case_state_campaign_idx
  on public.rtf_case_state (campaign_id, sort_order, case_id);

create index if not exists rtf_case_state_active_idx
  on public.rtf_case_state (campaign_id, is_active);

create table if not exists public.rtf_case_boards (
  campaign_id text not null,
  case_id text not null,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text,
  updated_by_user uuid references auth.users(id) on delete set null,
  updated_by_name text,
  primary key (campaign_id, case_id)
);

create table if not exists public.rtf_case_events (
  campaign_id text not null,
  case_id text not null,
  event_id text not null,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text,
  updated_by_user uuid references auth.users(id) on delete set null,
  updated_by_name text,
  primary key (campaign_id, case_id, event_id)
);

create index if not exists rtf_case_events_campaign_case_idx
  on public.rtf_case_events (campaign_id, case_id, updated_at desc);

-- 3) Campaign entity rows
create table if not exists public.rtf_campaign_players (
  campaign_id text not null,
  player_id text not null,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text,
  updated_by_user uuid references auth.users(id) on delete set null,
  updated_by_name text,
  primary key (campaign_id, player_id)
);

create table if not exists public.rtf_campaign_npcs (
  campaign_id text not null,
  npc_id text not null,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text,
  updated_by_user uuid references auth.users(id) on delete set null,
  updated_by_name text,
  primary key (campaign_id, npc_id)
);

create table if not exists public.rtf_campaign_locations (
  campaign_id text not null,
  location_id text not null,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text,
  updated_by_user uuid references auth.users(id) on delete set null,
  updated_by_name text,
  primary key (campaign_id, location_id)
);

create table if not exists public.rtf_campaign_requisitions (
  campaign_id text not null,
  requisition_id text not null,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text,
  updated_by_user uuid references auth.users(id) on delete set null,
  updated_by_name text,
  primary key (campaign_id, requisition_id)
);

create table if not exists public.rtf_campaign_encounters (
  campaign_id text not null,
  encounter_id text not null,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text,
  updated_by_user uuid references auth.users(id) on delete set null,
  updated_by_name text,
  primary key (campaign_id, encounter_id)
);

create index if not exists rtf_campaign_players_campaign_idx
  on public.rtf_campaign_players (campaign_id, updated_at desc);

create index if not exists rtf_campaign_npcs_campaign_idx
  on public.rtf_campaign_npcs (campaign_id, updated_at desc);

create index if not exists rtf_campaign_locations_campaign_idx
  on public.rtf_campaign_locations (campaign_id, updated_at desc);

create index if not exists rtf_campaign_requisitions_campaign_idx
  on public.rtf_campaign_requisitions (campaign_id, updated_at desc);

create index if not exists rtf_campaign_encounters_campaign_idx
  on public.rtf_campaign_encounters (campaign_id, updated_at desc);

-- 4) RLS + baseline auth policy
do $$
declare
  t text;
begin
  foreach t in array array[
    'rtf_campaign_core',
    'rtf_campaign_hq',
    'rtf_case_state',
    'rtf_case_boards',
    'rtf_case_events',
    'rtf_campaign_players',
    'rtf_campaign_npcs',
    'rtf_campaign_locations',
    'rtf_campaign_requisitions',
    'rtf_campaign_encounters'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_auth_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t || '_auth_rw',
      t
    );
  end loop;
end
$$;

-- 5) Realtime publication registration
do $$
declare
  t text;
begin
  foreach t in array array[
    'rtf_campaign_core',
    'rtf_campaign_hq',
    'rtf_case_state',
    'rtf_case_boards',
    'rtf_case_events',
    'rtf_campaign_players',
    'rtf_campaign_npcs',
    'rtf_campaign_locations',
    'rtf_campaign_requisitions',
    'rtf_campaign_encounters'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception
      when duplicate_object then null;
      when undefined_object then
        raise notice 'Publication supabase_realtime not found. Add tables manually after creating publication.';
    end;
  end loop;
end
$$;

-- 6) Backfill from legacy single-row table if it exists
do $migration$
begin
  if to_regclass('public.rtf_campaign_state') is null then
    raise notice 'Legacy table public.rtf_campaign_state not found. Skipping backfill.';
    return;
  end if;

  -- Core (rep, heat, case template)
  insert into public.rtf_campaign_core (
    campaign_id,
    payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  )
  select
    s.campaign_id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'rep', coalesce(s.state #> '{campaign,rep}', '{}'::jsonb),
        'heat', coalesce(s.state #> '{campaign,heat}', '0'::jsonb),
        'case', coalesce(s.state #> '{campaign,case}', '{}'::jsonb)
      )
    ) as payload,
    coalesce((s.state #>> '{meta,syncRevision}')::bigint, 0) as revision,
    coalesce(s.updated_at, timezone('utc', now())) as updated_at,
    s.updated_by,
    s.updated_by_user,
    s.updated_by_name
  from public.rtf_campaign_state s
  on conflict (campaign_id) do update set
    payload = excluded.payload,
    revision = greatest(public.rtf_campaign_core.revision, excluded.revision),
    updated_at = greatest(public.rtf_campaign_core.updated_at, excluded.updated_at),
    updated_by = excluded.updated_by,
    updated_by_user = excluded.updated_by_user,
    updated_by_name = excluded.updated_by_name;

  -- HQ
  insert into public.rtf_campaign_hq (
    campaign_id,
    payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  )
  select
    s.campaign_id,
    coalesce(s.state #> '{hq}', '{}'::jsonb) as payload,
    coalesce((s.state #>> '{meta,syncRevision}')::bigint, 0) as revision,
    coalesce(s.updated_at, timezone('utc', now())) as updated_at,
    s.updated_by,
    s.updated_by_user,
    s.updated_by_name
  from public.rtf_campaign_state s
  on conflict (campaign_id) do update set
    payload = excluded.payload,
    revision = greatest(public.rtf_campaign_hq.revision, excluded.revision),
    updated_at = greatest(public.rtf_campaign_hq.updated_at, excluded.updated_at),
    updated_by = excluded.updated_by,
    updated_by_user = excluded.updated_by_user,
    updated_by_name = excluded.updated_by_name;

  -- Case state rows
  with src as (
    select
      s.campaign_id,
      coalesce((s.state #>> '{meta,syncRevision}')::bigint, 0) as revision,
      coalesce(s.updated_at, timezone('utc', now())) as updated_at,
      s.updated_by,
      s.updated_by_user,
      s.updated_by_name,
      coalesce(nullif(s.state #>> '{cases,activeCaseId}', ''), 'case_primary') as active_case_id,
      coalesce(s.state #> '{cases,items}', '[]'::jsonb) as items
    from public.rtf_campaign_state s
  ),
  expanded as (
    select
      src.campaign_id,
      src.revision,
      src.updated_at,
      src.updated_by,
      src.updated_by_user,
      src.updated_by_name,
      src.active_case_id,
      e.item,
      e.ord
    from src
    cross join lateral jsonb_array_elements(src.items) with ordinality as e(item, ord)
  )
  insert into public.rtf_case_state (
    campaign_id,
    case_id,
    case_name,
    is_active,
    sort_order,
    payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  )
  select
    campaign_id,
    coalesce(nullif(item->>'id', ''), 'case_primary') as case_id,
    coalesce(nullif(item->>'name', ''), 'Primary Case') as case_name,
    coalesce(nullif(item->>'id', ''), 'case_primary') = active_case_id as is_active,
    (ord - 1)::integer as sort_order,
    jsonb_build_object('name', coalesce(nullif(item->>'name', ''), 'Primary Case')) as payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  from expanded
  on conflict (campaign_id, case_id) do update set
    case_name = excluded.case_name,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    payload = excluded.payload,
    revision = greatest(public.rtf_case_state.revision, excluded.revision),
    updated_at = greatest(public.rtf_case_state.updated_at, excluded.updated_at),
    updated_by = excluded.updated_by,
    updated_by_user = excluded.updated_by_user,
    updated_by_name = excluded.updated_by_name;

  -- Ensure every campaign has at least one case row
  insert into public.rtf_case_state (
    campaign_id,
    case_id,
    case_name,
    is_active,
    sort_order,
    payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  )
  select
    s.campaign_id,
    'case_primary',
    'Primary Case',
    true,
    0,
    '{"name":"Primary Case"}'::jsonb,
    coalesce((s.state #>> '{meta,syncRevision}')::bigint, 0),
    coalesce(s.updated_at, timezone('utc', now())),
    s.updated_by,
    s.updated_by_user,
    s.updated_by_name
  from public.rtf_campaign_state s
  where not exists (
    select 1
    from public.rtf_case_state cs
    where cs.campaign_id = s.campaign_id
  )
  on conflict (campaign_id, case_id) do nothing;

  -- Case boards from cases.items[*].board
  with src as (
    select
      s.campaign_id,
      coalesce((s.state #>> '{meta,syncRevision}')::bigint, 0) as revision,
      coalesce(s.updated_at, timezone('utc', now())) as updated_at,
      s.updated_by,
      s.updated_by_user,
      s.updated_by_name,
      coalesce(s.state #> '{cases,items}', '[]'::jsonb) as items
    from public.rtf_campaign_state s
  ),
  expanded as (
    select
      src.campaign_id,
      src.revision,
      src.updated_at,
      src.updated_by,
      src.updated_by_user,
      src.updated_by_name,
      e.item
    from src
    cross join lateral jsonb_array_elements(src.items) as e(item)
  )
  insert into public.rtf_case_boards (
    campaign_id,
    case_id,
    payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  )
  select
    campaign_id,
    coalesce(nullif(item->>'id', ''), 'case_primary') as case_id,
    coalesce(
      item->'board',
      jsonb_build_object(
        'name', coalesce(nullif(item->>'name', ''), 'UNNAMED CASE'),
        'nodes', '[]'::jsonb,
        'connections', '[]'::jsonb
      )
    ) as payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  from expanded
  on conflict (campaign_id, case_id) do update set
    payload = excluded.payload,
    revision = greatest(public.rtf_case_boards.revision, excluded.revision),
    updated_at = greatest(public.rtf_case_boards.updated_at, excluded.updated_at),
    updated_by = excluded.updated_by,
    updated_by_user = excluded.updated_by_user,
    updated_by_name = excluded.updated_by_name;

  -- Backfill any missing board rows (fallback to legacy root board for case_primary)
  insert into public.rtf_case_boards (
    campaign_id,
    case_id,
    payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  )
  select
    cs.campaign_id,
    cs.case_id,
    case
      when cs.case_id = 'case_primary' then
        coalesce(
          s.state #> '{board}',
          jsonb_build_object('name', cs.case_name, 'nodes', '[]'::jsonb, 'connections', '[]'::jsonb)
        )
      else
        jsonb_build_object('name', cs.case_name, 'nodes', '[]'::jsonb, 'connections', '[]'::jsonb)
    end as payload,
    cs.revision,
    cs.updated_at,
    cs.updated_by,
    cs.updated_by_user,
    cs.updated_by_name
  from public.rtf_case_state cs
  join public.rtf_campaign_state s
    on s.campaign_id = cs.campaign_id
  where not exists (
    select 1
    from public.rtf_case_boards b
    where b.campaign_id = cs.campaign_id
      and b.case_id = cs.case_id
  )
  on conflict (campaign_id, case_id) do nothing;

  -- Case events from cases.items[*].events
  with src as (
    select
      s.campaign_id,
      coalesce((s.state #>> '{meta,syncRevision}')::bigint, 0) as revision,
      coalesce(s.updated_at, timezone('utc', now())) as updated_at,
      s.updated_by,
      s.updated_by_user,
      s.updated_by_name,
      coalesce(s.state #> '{cases,items}', '[]'::jsonb) as items
    from public.rtf_campaign_state s
  ),
  case_rows as (
    select
      src.campaign_id,
      src.revision,
      src.updated_at,
      src.updated_by,
      src.updated_by_user,
      src.updated_by_name,
      e.case_item
    from src
    cross join lateral jsonb_array_elements(src.items) as e(case_item)
  ),
  events as (
    select
      case_rows.campaign_id,
      case_rows.revision,
      case_rows.updated_at,
      case_rows.updated_by,
      case_rows.updated_by_user,
      case_rows.updated_by_name,
      coalesce(nullif(case_rows.case_item->>'id', ''), 'case_primary') as case_id,
      ev.event_item,
      ev.event_ord
    from case_rows
    cross join lateral jsonb_array_elements(coalesce(case_rows.case_item->'events', '[]'::jsonb))
      with ordinality as ev(event_item, event_ord)
  )
  insert into public.rtf_case_events (
    campaign_id,
    case_id,
    event_id,
    payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  )
  select
    campaign_id,
    case_id,
    coalesce(
      nullif(event_item->>'id', ''),
      'event_' || substr(md5(campaign_id || ':' || case_id || ':' || event_ord::text || ':' || event_item::text), 1, 12)
    ) as event_id,
    event_item as payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  from events
  on conflict (campaign_id, case_id, event_id) do update set
    payload = excluded.payload,
    revision = greatest(public.rtf_case_events.revision, excluded.revision),
    updated_at = greatest(public.rtf_case_events.updated_at, excluded.updated_at),
    updated_by = excluded.updated_by,
    updated_by_user = excluded.updated_by_user,
    updated_by_name = excluded.updated_by_name;

  -- Legacy fallback: campaign.events -> case_primary events
  with src as (
    select
      s.campaign_id,
      coalesce((s.state #>> '{meta,syncRevision}')::bigint, 0) as revision,
      coalesce(s.updated_at, timezone('utc', now())) as updated_at,
      s.updated_by,
      s.updated_by_user,
      s.updated_by_name,
      coalesce(s.state #> '{campaign,events}', '[]'::jsonb) as events
    from public.rtf_campaign_state s
  ),
  expanded as (
    select
      src.campaign_id,
      src.revision,
      src.updated_at,
      src.updated_by,
      src.updated_by_user,
      src.updated_by_name,
      e.event_item,
      e.event_ord
    from src
    cross join lateral jsonb_array_elements(src.events) with ordinality as e(event_item, event_ord)
  )
  insert into public.rtf_case_events (
    campaign_id,
    case_id,
    event_id,
    payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  )
  select
    campaign_id,
    'case_primary' as case_id,
    coalesce(
      nullif(event_item->>'id', ''),
      'event_' || substr(md5(campaign_id || ':case_primary:' || event_ord::text || ':' || event_item::text), 1, 12)
    ) as event_id,
    event_item as payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  from expanded
  on conflict (campaign_id, case_id, event_id) do nothing;

  -- Generic helper pattern for entity arrays: players, npcs, locations, requisitions, encounters
  with src as (
    select
      s.campaign_id,
      coalesce((s.state #>> '{meta,syncRevision}')::bigint, 0) as revision,
      coalesce(s.updated_at, timezone('utc', now())) as updated_at,
      s.updated_by,
      s.updated_by_user,
      s.updated_by_name,
      coalesce(s.state #> '{campaign,players}', '[]'::jsonb) as items
    from public.rtf_campaign_state s
  ),
  expanded as (
    select
      src.campaign_id,
      src.revision,
      src.updated_at,
      src.updated_by,
      src.updated_by_user,
      src.updated_by_name,
      e.item,
      e.ord
    from src
    cross join lateral jsonb_array_elements(src.items) with ordinality as e(item, ord)
  )
  insert into public.rtf_campaign_players (
    campaign_id,
    player_id,
    payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  )
  select
    campaign_id,
    coalesce(
      nullif(item->>'id', ''),
      'player_' || substr(md5(campaign_id || ':' || ord::text || ':' || item::text), 1, 12)
    ) as player_id,
    item as payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  from expanded
  on conflict (campaign_id, player_id) do update set
    payload = excluded.payload,
    revision = greatest(public.rtf_campaign_players.revision, excluded.revision),
    updated_at = greatest(public.rtf_campaign_players.updated_at, excluded.updated_at),
    updated_by = excluded.updated_by,
    updated_by_user = excluded.updated_by_user,
    updated_by_name = excluded.updated_by_name;

  with src as (
    select
      s.campaign_id,
      coalesce((s.state #>> '{meta,syncRevision}')::bigint, 0) as revision,
      coalesce(s.updated_at, timezone('utc', now())) as updated_at,
      s.updated_by,
      s.updated_by_user,
      s.updated_by_name,
      coalesce(s.state #> '{campaign,npcs}', '[]'::jsonb) as items
    from public.rtf_campaign_state s
  ),
  expanded as (
    select
      src.campaign_id,
      src.revision,
      src.updated_at,
      src.updated_by,
      src.updated_by_user,
      src.updated_by_name,
      e.item,
      e.ord
    from src
    cross join lateral jsonb_array_elements(src.items) with ordinality as e(item, ord)
  )
  insert into public.rtf_campaign_npcs (
    campaign_id,
    npc_id,
    payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  )
  select
    campaign_id,
    coalesce(
      nullif(item->>'id', ''),
      'npc_' || substr(md5(campaign_id || ':' || ord::text || ':' || item::text), 1, 12)
    ) as npc_id,
    item as payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  from expanded
  on conflict (campaign_id, npc_id) do update set
    payload = excluded.payload,
    revision = greatest(public.rtf_campaign_npcs.revision, excluded.revision),
    updated_at = greatest(public.rtf_campaign_npcs.updated_at, excluded.updated_at),
    updated_by = excluded.updated_by,
    updated_by_user = excluded.updated_by_user,
    updated_by_name = excluded.updated_by_name;

  with src as (
    select
      s.campaign_id,
      coalesce((s.state #>> '{meta,syncRevision}')::bigint, 0) as revision,
      coalesce(s.updated_at, timezone('utc', now())) as updated_at,
      s.updated_by,
      s.updated_by_user,
      s.updated_by_name,
      coalesce(s.state #> '{campaign,locations}', '[]'::jsonb) as items
    from public.rtf_campaign_state s
  ),
  expanded as (
    select
      src.campaign_id,
      src.revision,
      src.updated_at,
      src.updated_by,
      src.updated_by_user,
      src.updated_by_name,
      e.item,
      e.ord
    from src
    cross join lateral jsonb_array_elements(src.items) with ordinality as e(item, ord)
  )
  insert into public.rtf_campaign_locations (
    campaign_id,
    location_id,
    payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  )
  select
    campaign_id,
    coalesce(
      nullif(item->>'id', ''),
      'loc_' || substr(md5(campaign_id || ':' || ord::text || ':' || item::text), 1, 12)
    ) as location_id,
    item as payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  from expanded
  on conflict (campaign_id, location_id) do update set
    payload = excluded.payload,
    revision = greatest(public.rtf_campaign_locations.revision, excluded.revision),
    updated_at = greatest(public.rtf_campaign_locations.updated_at, excluded.updated_at),
    updated_by = excluded.updated_by,
    updated_by_user = excluded.updated_by_user,
    updated_by_name = excluded.updated_by_name;

  with src as (
    select
      s.campaign_id,
      coalesce((s.state #>> '{meta,syncRevision}')::bigint, 0) as revision,
      coalesce(s.updated_at, timezone('utc', now())) as updated_at,
      s.updated_by,
      s.updated_by_user,
      s.updated_by_name,
      coalesce(s.state #> '{campaign,requisitions}', '[]'::jsonb) as items
    from public.rtf_campaign_state s
  ),
  expanded as (
    select
      src.campaign_id,
      src.revision,
      src.updated_at,
      src.updated_by,
      src.updated_by_user,
      src.updated_by_name,
      e.item,
      e.ord
    from src
    cross join lateral jsonb_array_elements(src.items) with ordinality as e(item, ord)
  )
  insert into public.rtf_campaign_requisitions (
    campaign_id,
    requisition_id,
    payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  )
  select
    campaign_id,
    coalesce(
      nullif(item->>'id', ''),
      'req_' || substr(md5(campaign_id || ':' || ord::text || ':' || item::text), 1, 12)
    ) as requisition_id,
    item as payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  from expanded
  on conflict (campaign_id, requisition_id) do update set
    payload = excluded.payload,
    revision = greatest(public.rtf_campaign_requisitions.revision, excluded.revision),
    updated_at = greatest(public.rtf_campaign_requisitions.updated_at, excluded.updated_at),
    updated_by = excluded.updated_by,
    updated_by_user = excluded.updated_by_user,
    updated_by_name = excluded.updated_by_name;

  with src as (
    select
      s.campaign_id,
      coalesce((s.state #>> '{meta,syncRevision}')::bigint, 0) as revision,
      coalesce(s.updated_at, timezone('utc', now())) as updated_at,
      s.updated_by,
      s.updated_by_user,
      s.updated_by_name,
      coalesce(s.state #> '{campaign,encounters}', '[]'::jsonb) as items
    from public.rtf_campaign_state s
  ),
  expanded as (
    select
      src.campaign_id,
      src.revision,
      src.updated_at,
      src.updated_by,
      src.updated_by_user,
      src.updated_by_name,
      e.item,
      e.ord
    from src
    cross join lateral jsonb_array_elements(src.items) with ordinality as e(item, ord)
  )
  insert into public.rtf_campaign_encounters (
    campaign_id,
    encounter_id,
    payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  )
  select
    campaign_id,
    coalesce(
      nullif(item->>'id', ''),
      'enc_' || substr(md5(campaign_id || ':' || ord::text || ':' || item::text), 1, 12)
    ) as encounter_id,
    item as payload,
    revision,
    updated_at,
    updated_by,
    updated_by_user,
    updated_by_name
  from expanded
  on conflict (campaign_id, encounter_id) do update set
    payload = excluded.payload,
    revision = greatest(public.rtf_campaign_encounters.revision, excluded.revision),
    updated_at = greatest(public.rtf_campaign_encounters.updated_at, excluded.updated_at),
    updated_by = excluded.updated_by,
    updated_by_user = excluded.updated_by_user,
    updated_by_name = excluded.updated_by_name;
end
$migration$;

commit;

-- Validation queries (run after commit)
-- select count(*) as legacy_campaigns from public.rtf_campaign_state;
-- select count(*) as core_campaigns from public.rtf_campaign_core;
-- select campaign_id, count(*) as npc_count from public.rtf_campaign_npcs group by campaign_id order by campaign_id;
-- select campaign_id, count(*) as case_count from public.rtf_case_state group by campaign_id order by campaign_id;
-- select campaign_id, case_id, count(*) as event_count from public.rtf_case_events group by campaign_id, case_id order by campaign_id, case_id;
