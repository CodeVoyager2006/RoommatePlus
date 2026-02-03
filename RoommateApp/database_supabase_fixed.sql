-- RoommatePlus (Supabase) Database Schema
--
-- This schema implements a shared household management system with the following features:
-- - User authentication through Supabase Auth
-- - Household membership with role-based access (owner, admin, member)
-- - Chore management with multi-user assignments and recurring schedules
-- - Shared machine tracking (washers, dryers, etc.)
-- - Discussion threads for household communication
-- - Point and streak system for gamification
--
-- Key Design Decisions:
-- - Each user belongs to exactly one household (enforced by unique constraint)
-- - Chores use a many-to-many relationship with users via chore_assignments table
-- - Machine status includes 'busy' state with occupied_by tracking
-- - Repeat schedules use bitmask encoding for weekly days (Sun=1, Mon=2, Tue=4, etc.)
-- - Thread discussions support optional chore association
--
-- Run inside the Supabase SQL Editor (or via Supabase CLI migrations).
--
-- WARNING: This script drops tables in the public schema. Use only on a fresh project
-- or after exporting data.


-----------------------------
-- 0) Extensions
-----------------------------
create extension if not exists pgcrypto; -- gen_random_uuid(), gen_random_bytes()
create extension if not exists citext;   -- case-insensitive text

-----------------------------
-- 1) Drop old schema (dev only)
-----------------------------
-- These match your current script (unquoted identifiers become lowercase).
drop view if exists public.chores_with_details cascade;
drop view if exists public.user_chores cascade;
drop view if exists public.household_machines cascade;

drop table if exists public.message cascade;
drop table if exists public.messages cascade;
drop table if exists public.thread cascade;
drop table if exists public.threads cascade;
drop table if exists public.chore_assignments cascade;
drop table if exists public.userchore cascade;
drop table if exists public.chore cascade;
drop table if exists public.chores cascade;
drop table if exists public.machine cascade;
drop table if exists public.machines cascade;
drop table if exists public.household_members cascade;
drop table if exists public.household_invites cascade;
drop table if exists public.appuser cascade;
drop table if exists public.profiles cascade;
drop table if exists public.household cascade;
drop table if exists public.households cascade;

drop function if exists public.create_household(text) cascade;
drop function if exists public.join_household(text) cascade;
drop function if exists public.rotate_household_invite(uuid) cascade;
drop function if exists public.leave_household(uuid) cascade;
drop function if exists public.is_household_member(uuid) cascade;
drop function if exists public.is_household_admin(uuid) cascade;
drop function if exists public.is_household_owner(uuid) cascade;
drop function if exists public.prevent_created_by_change() cascade;
drop function if exists public.prevent_sender_id_change() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.handle_new_auth_user() cascade;
drop function if exists public.handle_auth_user_email_update() cascade;
drop function if exists public._generate_invite_code(int) cascade;

drop type if exists public.chore_status cascade;
drop type if exists public.repeat_unit cascade;
drop type if exists public.machine_status cascade;
drop type if exists public.household_role cascade;

-----------------------------
-- 2) Enums
-----------------------------
create type public.chore_status as enum ('incomplete', 'late', 'completed', 'abandoned');
create type public.repeat_unit as enum ('none', 'daily', 'weekly', 'monthly');

-- Machine states: available (ready for use), busy (currently occupied), maintenance (out of service)
create type public.machine_status as enum ('available', 'busy', 'maintenance');

create type public.household_role as enum ('owner', 'admin', 'member');

-----------------------------
-- 3) Timestamp helper
-----------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-----------------------------
-- 4) Profiles (app user data)
-----------------------------
create table public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       citext not null,
  first_name  text,
  last_name   text,
  streak      integer not null default 0,
  points      integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint uq_profiles_email unique (email),
  constraint chk_profiles_email_format check (
    email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
  ),
  constraint chk_profiles_streak_nonneg check (streak >= 0),
  constraint chk_profiles_points_nonneg check (points >= 0),
  constraint chk_profiles_first_name check (first_name is null or (length(trim(first_name)) between 1 and 50)),
  constraint chk_profiles_last_name  check (last_name  is null or (length(trim(last_name))  between 1 and 50))
);

comment on table public.profiles is 'User profile data synced with Supabase Auth';
comment on column public.profiles.streak is 'Number of consecutive days user has completed chores';
comment on column public.profiles.points is 'Total points earned from completing chores';

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();


-- Keep profiles in sync with auth.users
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  insert into public.profiles (user_id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'last_name',  '')), '')
  )
  on conflict (user_id) do update
    set email = excluded.email,
        first_name = coalesce(public.profiles.first_name, excluded.first_name),
        last_name  = coalesce(public.profiles.last_name,  excluded.last_name);

  return new;
end;
$$;

create or replace function public.handle_auth_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
      set email = new.email,
          updated_at = now()
    where user_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email on auth.users
for each row execute function public.handle_auth_user_email_update();

-----------------------------
-- 5) Core tables
-----------------------------
create table public.households (
  household_id uuid primary key default gen_random_uuid(),
  name         text not null,
  created_by   uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint chk_households_name_nonempty check (length(trim(name)) > 0)
);

comment on table public.households is 'Shared living spaces (apartments, houses, etc.)';

create trigger trg_households_updated_at
before update on public.households
for each row execute function public.set_updated_at();

-- Invite codes live in a separate table so they can be RLS-protected.
create table public.household_invites (
  household_id uuid primary key references public.households(household_id) on delete cascade,
  invite_code  text not null unique,
  created_at   timestamptz not null default now(),
  rotated_at   timestamptz,

  constraint chk_invite_code_len check (length(invite_code) between 8 and 32),
  constraint chk_invite_code_chars check (invite_code ~ '^[A-Za-z0-9]+$')
);

comment on table public.household_invites is 'Invite codes for users to join households';

create table public.household_members (
  household_id uuid not null references public.households(household_id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         public.household_role not null default 'member',
  joined_at    timestamptz not null default now(),

  primary key (household_id, user_id)
);

comment on table public.household_members is 'Many-to-many relationship between users and households';

-- Enforce business rule: each user can only belong to one household at a time
-- This constraint can be removed if multi-household membership is needed in the future
alter table public.household_members 
  add constraint uq_one_household_per_user unique (user_id);

comment on constraint uq_one_household_per_user on public.household_members is 
  'Enforces business rule: each user belongs to exactly one household. Remove this constraint to allow multi-household membership.';

create index idx_household_members_user_id on public.household_members(user_id);
create index idx_household_members_household_id on public.household_members(household_id);

create table public.machines (
  machine_id   uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id) on delete cascade,
  name         text not null,
  image_url    text,
  status       public.machine_status not null default 'available',
  
  -- Tracks which user is currently using this machine (only when status='busy')
  occupied_by  uuid references auth.users(id) on delete set null,
  
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint chk_machine_name_nonempty check (length(trim(name)) > 0),
  
  -- Business rule: busy machines must have an occupier set
  constraint chk_machine_occupied_when_busy check (
    (status = 'busy' and occupied_by is not null) or
    (status != 'busy')
  )
);

comment on table public.machines is 'Shared appliances (washers, dryers, etc.)';
comment on column public.machines.occupied_by is 'User currently using this machine (only when status=busy)';
comment on constraint chk_machine_occupied_when_busy on public.machines is 
  'Ensures occupied_by is set when machine is busy';

create unique index uq_machines_name_per_household on public.machines (household_id, lower(name));
create index idx_machines_household_id on public.machines(household_id);
-- Index for filtering machines by status (e.g., finding all available machines)
create index idx_machines_status on public.machines(household_id, status);
create index idx_machines_occupied_by on public.machines(occupied_by);

create trigger trg_machines_updated_at
before update on public.machines
for each row execute function public.set_updated_at();

create table public.chores (
  chore_id     uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id) on delete cascade,
  machine_id   uuid references public.machines(machine_id) on delete set null,

  title        text not null,
  description  text,
  
  -- Stores the due date/time as a full timestamp with timezone
  -- Frontend may send dates as "2025-06-30" strings which must be converted to timestamptz
  due_at       timestamptz,

  status       public.chore_status not null default 'incomplete',

  -- Repeat scheduling configuration
  -- repeat_unit: how often the chore repeats (none, daily, weekly, monthly)
  -- repeat_interval: multiplier for the unit (e.g., every 2 weeks)
  repeat_unit     public.repeat_unit not null default 'none',
  repeat_interval integer not null default 1,
  
  -- Bitmask encoding for days of the week (only used when repeat_unit='weekly')
  -- Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64
  -- Example: Monday + Friday = 2 + 32 = 34
  -- Frontend uses arrays like ["Mon","Fri"] which must be converted to/from this format
  repeat_days     smallint not null default 0,

  point_value  integer not null default 0,

  created_by   uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  completed_at         timestamptz,
  completion_image_url text,
  abandoned_at         timestamptz,
  abandon_reason       text,

  -- Basic sanity constraints
  constraint chk_chore_title_nonempty check (length(trim(title)) > 0),
  constraint chk_repeat_interval_positive check (repeat_interval >= 1),
  constraint chk_repeat_days_valid check (repeat_days between 0 and 127),
  constraint chk_point_value_nonneg check (point_value >= 0),

  -- Enforce correct usage of repeat_days field:
  -- - Non-weekly chores must have repeat_days = 0
  -- - Weekly chores must have at least one day selected (1-127)
  constraint chk_repeat_days_weekly
    check (
      (repeat_unit <> 'weekly' and repeat_days = 0)
      or
      (repeat_unit = 'weekly' and repeat_days between 1 and 127)
    )
);

comment on table public.chores is 'Tasks assigned to household members';
comment on column public.chores.repeat_days is 
  'Bitmask for weekly repeats: Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64. Example: Mon+Fri = 2+32 = 34';
comment on column public.chores.due_at is 
  'Due date/time. Frontend may send "2025-06-30" which must be converted to timestamptz';

create index idx_chores_household_id on public.chores(household_id);
create index idx_chores_machine_id on public.chores(machine_id);
create index idx_chores_due_at on public.chores(due_at);
create index idx_chores_created_by on public.chores(created_by);
create index idx_chores_status on public.chores(household_id, status);

create trigger trg_chores_updated_at
before update on public.chores
for each row execute function public.set_updated_at();

-- Junction table for many-to-many chore assignments
-- Allows multiple users to be assigned to a single chore
-- Frontend represents this as peopleAssigned array ["You", "Alice"] which must be converted
create table public.chore_assignments (
  chore_id     uuid not null references public.chores(chore_id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  assigned_by  uuid references auth.users(id) on delete set null default auth.uid(),
  assigned_at  timestamptz not null default now(),

  primary key (chore_id, user_id)
);

comment on table public.chore_assignments is 
  'Many-to-many chore assignments. Frontend expects peopleAssigned array, app layer must convert to/from this table.';

create index idx_chore_assignments_user_id on public.chore_assignments(user_id);
create index idx_chore_assignments_chore_id on public.chore_assignments(chore_id);
-- Composite index for efficiently querying all chores for a specific user
create index idx_chore_assignments_user_chore on public.chore_assignments(user_id, chore_id);

create table public.threads (
  thread_id    uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id) on delete cascade,
  chore_id     uuid references public.chores(chore_id) on delete cascade,
  
  -- Discussion subject/title - required field for thread identification
  title        text not null default 'Untitled',
  
  created_by   uuid not null references auth.users(id) on delete restrict default auth.uid(),
  ai_summary   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint chk_thread_title_nonempty check (length(trim(title)) > 0)
);

comment on table public.threads is 'Discussion threads for household communication';
comment on column public.threads.title is 'Thread subject/title (required)';
comment on column public.threads.ai_summary is 'AI-generated summary of thread messages';

create index idx_threads_household_id on public.threads(household_id);
create index idx_threads_chore_id on public.threads(chore_id);
create index idx_threads_created_by on public.threads(created_by);

create trigger trg_threads_updated_at
before update on public.threads
for each row execute function public.set_updated_at();

create table public.messages (
  message_id uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.threads(thread_id) on delete cascade,
  sender_id  uuid references auth.users(id) on delete set null default auth.uid(),
  
  -- Message text content (frontend uses field name 'text', database uses 'content')
  content    text not null,
  
  -- Timestamp when message was sent (frontend uses field name 'createdAt', database uses 'sent_at')
  sent_at    timestamptz not null default now(),

  constraint chk_message_content_nonempty check (length(trim(content)) > 0)
);

comment on table public.messages is 
  'Messages within threads. Frontend expects {author, text, createdAt}, app layer must map to {sender_id, content, sent_at}';

create index idx_messages_thread_id on public.messages(thread_id);
create index idx_messages_sender_id on public.messages(sender_id);
create index idx_messages_sent_at on public.messages(thread_id, sent_at);

-----------------------------
-- 6) Helper auth/rls functions
-----------------------------
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = hid
      and hm.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_admin(hid uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = hid
      and hm.user_id = auth.uid()
      and hm.role in ('owner','admin')
  );
$$;

create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = hid
      and hm.user_id = auth.uid()
      and hm.role = 'owner'
  );
$$;

-----------------------------
-- 6b) Immutable column guards (prevents "ownership" tampering)
-----------------------------
create or replace function public.prevent_created_by_change()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_sender_id_change()
returns trigger
language plpgsql
as $$
begin
  if new.sender_id is distinct from old.sender_id then
    raise exception 'sender_id is immutable';
  end if;
  return new;
end;
$$;

create trigger trg_households_created_by_immutable
before update on public.households
for each row execute function public.prevent_created_by_change();

create trigger trg_machines_created_by_immutable
before update on public.machines
for each row execute function public.prevent_created_by_change();

create trigger trg_chores_created_by_immutable
before update on public.chores
for each row execute function public.prevent_created_by_change();

create trigger trg_threads_created_by_immutable
before update on public.threads
for each row execute function public.prevent_created_by_change();

create trigger trg_messages_sender_id_immutable
before update on public.messages
for each row execute function public.prevent_sender_id_change();

-----------------------------
-- 7) RLS (Row Level Security)
-----------------------------
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_invites enable row level security;
alter table public.household_members enable row level security;
alter table public.machines enable row level security;
alter table public.chores enable row level security;
alter table public.chore_assignments enable row level security;
alter table public.threads enable row level security;
alter table public.messages enable row level security;

-- Force RLS even for table owners (service_role still bypasses).
alter table public.profiles force row level security;
alter table public.households force row level security;
alter table public.household_invites force row level security;
alter table public.household_members force row level security;
alter table public.machines force row level security;
alter table public.chores force row level security;
alter table public.chore_assignments force row level security;
alter table public.threads force row level security;
alter table public.messages force row level security;

-- Profiles: only the user can read/update their row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Allow users to view profiles of people in their household
drop policy if exists "profiles_select_housemates" on public.profiles;
create policy "profiles_select_housemates"
  on public.profiles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.household_members hm1
      join public.household_members hm2 on hm1.household_id = hm2.household_id
      where hm1.user_id = auth.uid()
        and hm2.user_id = public.profiles.user_id
    )
  );

-- Households: members can read; admins can update; owner can delete.
drop policy if exists "households_select_member" on public.households;
create policy "households_select_member"
  on public.households
  for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "households_update_admin" on public.households;
create policy "households_update_admin"
  on public.households
  for update
  to authenticated
  using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

drop policy if exists "households_delete_owner" on public.households;
create policy "households_delete_owner"
  on public.households
  for delete
  to authenticated
  using (public.is_household_owner(household_id));

-- Household invites: only admins can read/rotate.
drop policy if exists "invites_select_admin" on public.household_invites;
create policy "invites_select_admin"
  on public.household_invites
  for select
  to authenticated
  using (public.is_household_admin(household_id));

drop policy if exists "invites_update_admin" on public.household_invites;
create policy "invites_update_admin"
  on public.household_invites
  for update
  to authenticated
  using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

-- Household members: members can read; owner can change roles; owner or self can remove.
drop policy if exists "members_select_member" on public.household_members;
create policy "members_select_member"
  on public.household_members
  for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "members_update_owner" on public.household_members;
create policy "members_update_owner"
  on public.household_members
  for update
  to authenticated
  using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id));

drop policy if exists "members_delete_owner_or_self" on public.household_members;
create policy "members_delete_owner_or_self"
  on public.household_members
  for delete
  to authenticated
  using (public.is_household_owner(household_id) or user_id = auth.uid());

-- Machines: members can read; members can insert; admins can update/delete.
drop policy if exists "machines_select_member" on public.machines;
create policy "machines_select_member"
  on public.machines
  for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "machines_insert_member" on public.machines;
create policy "machines_insert_member"
  on public.machines
  for insert
  to authenticated
  with check (public.is_household_member(household_id));

-- Allow household members to update machine status (mark as busy/available)
drop policy if exists "machines_update_member_status" on public.machines;
create policy "machines_update_member_status"
  on public.machines
  for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "machines_delete_admin" on public.machines;
create policy "machines_delete_admin"
  on public.machines
  for delete
  to authenticated
  using (public.is_household_admin(household_id));

-- Chores: members can read/insert; creator/admin/assignee can update; creator/admin can delete.
drop policy if exists "chores_select_member" on public.chores;
create policy "chores_select_member"
  on public.chores
  for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "chores_insert_member" on public.chores;
create policy "chores_insert_member"
  on public.chores
  for insert
  to authenticated
  with check (
    public.is_household_member(household_id)
    and created_by = auth.uid()
  );

drop policy if exists "chores_update_creator_admin_assignee" on public.chores;
create policy "chores_update_creator_admin_assignee"
  on public.chores
  for update
  to authenticated
  using (
    public.is_household_member(household_id)
    and (
      created_by = auth.uid()
      or public.is_household_admin(household_id)
      or exists (
        select 1 from public.chore_assignments ca
        where ca.chore_id = chores.chore_id
          and ca.user_id = auth.uid()
      )
    )
  )
  with check (public.is_household_member(household_id));

drop policy if exists "chores_delete_creator_admin" on public.chores;
create policy "chores_delete_creator_admin"
  on public.chores
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_household_admin(household_id)
  );

-- Chore assignments: members can read; creator/admin can assign/unassign.
drop policy if exists "assignments_select_member" on public.chore_assignments;
create policy "assignments_select_member"
  on public.chore_assignments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.chores c
      where c.chore_id = chore_assignments.chore_id
        and public.is_household_member(c.household_id)
    )
  );

drop policy if exists "assignments_insert_creator_admin" on public.chore_assignments;
create policy "assignments_insert_creator_admin"
  on public.chore_assignments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.chores c
      where c.chore_id = chore_assignments.chore_id
        and public.is_household_member(c.household_id)
        and (c.created_by = auth.uid() or public.is_household_admin(c.household_id))
    )
  );

drop policy if exists "assignments_delete_creator_admin" on public.chore_assignments;
create policy "assignments_delete_creator_admin"
  on public.chore_assignments
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.chores c
      where c.chore_id = chore_assignments.chore_id
        and public.is_household_member(c.household_id)
        and (c.created_by = auth.uid() or public.is_household_admin(c.household_id))
    )
  );

-- Threads: members can read; creator/admin can mutate.
drop policy if exists "threads_select_member" on public.threads;
create policy "threads_select_member"
  on public.threads
  for select
  to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "threads_insert_member" on public.threads;
create policy "threads_insert_member"
  on public.threads
  for insert
  to authenticated
  with check (public.is_household_member(household_id) and created_by = auth.uid());

drop policy if exists "threads_update_creator_admin" on public.threads;
create policy "threads_update_creator_admin"
  on public.threads
  for update
  to authenticated
  using (
    public.is_household_member(household_id)
    and (created_by = auth.uid() or public.is_household_admin(household_id))
  )
  with check (public.is_household_member(household_id));

drop policy if exists "threads_delete_creator_admin" on public.threads;
create policy "threads_delete_creator_admin"
  on public.threads
  for delete
  to authenticated
  using (created_by = auth.uid() or public.is_household_admin(household_id));

-- Messages: household members can read (via thread); sender can write/update/delete their own.
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.threads t
      where t.thread_id = messages.thread_id
        and public.is_household_member(t.household_id)
    )
  );

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.threads t
      where t.thread_id = messages.thread_id
        and public.is_household_member(t.household_id)
    )
  );

drop policy if exists "messages_update_sender" on public.messages;
create policy "messages_update_sender"
  on public.messages
  for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

drop policy if exists "messages_delete_sender" on public.messages;
create policy "messages_delete_sender"
  on public.messages
  for delete
  to authenticated
  using (sender_id = auth.uid());

-----------------------------
-- 8) Helper Views
-----------------------------

-- View: chores_with_details
-- Simplifies querying chores by aggregating assignee information into arrays
-- Returns assignee_ids (UUIDs) and assignee_names (display names) for each chore
create or replace view public.chores_with_details as
select 
  c.chore_id,
  c.household_id,
  c.machine_id,
  c.title,
  c.description,
  c.due_at,
  c.status,
  c.repeat_unit,
  c.repeat_interval,
  c.repeat_days,
  c.point_value,
  c.created_by,
  c.created_at,
  c.updated_at,
  c.completed_at,
  c.completion_image_url,
  c.abandoned_at,
  c.abandon_reason,
  
  -- Aggregate assignee information
  coalesce(
    array_agg(
      p.user_id
      order by ca.assigned_at
    ) filter (where p.user_id is not null),
    array[]::uuid[]
  ) as assignee_ids,
  
  coalesce(
    array_agg(
      coalesce(
        trim(p.first_name || ' ' || coalesce(p.last_name, '')),
        p.email
      )
      order by ca.assigned_at
    ) filter (where p.user_id is not null),
    array[]::text[]
  ) as assignee_names
  
from public.chores c
left join public.chore_assignments ca on c.chore_id = ca.chore_id
left join public.profiles p on ca.user_id = p.user_id
group by c.chore_id;

comment on view public.chores_with_details is 
  'Chores with assignee information aggregated. Use this for easier frontend integration.';

-- View: user_chores
-- Joins chore_assignments with chores to show all chores for each user
-- Useful for displaying "My Chores" lists
create or replace view public.user_chores as
select 
  ca.user_id,
  c.*
from public.chore_assignments ca
join public.chores c on ca.chore_id = c.chore_id;

comment on view public.user_chores is 
  'All chores assigned to each user. Filter by user_id = auth.uid() to get current user chores.';

-- View: household_machines
-- Enriches machines table with occupier name for easier display
-- Shows who is currently using each machine (if busy)
create or replace view public.household_machines as
select 
  m.machine_id,
  m.household_id,
  m.name,
  m.image_url,
  m.status,
  m.occupied_by,
  m.created_by,
  m.created_at,
  m.updated_at,
  
  -- Occupier name (if busy)
  case 
    when m.occupied_by is not null then
      coalesce(
        trim(p.first_name || ' ' || coalesce(p.last_name, '')),
        p.email,
        'Unknown'
      )
    else null
  end as occupied_by_name
  
from public.machines m
left join public.profiles p on m.occupied_by = p.user_id;

comment on view public.household_machines is 
  'Machines with occupier information. Use this for easier frontend integration.';

-----------------------------
-- 9) RPC functions (safe household create/join)
-----------------------------
create or replace function public._generate_invite_code(code_len int default 10)
returns text
language plpgsql
volatile
as $$
declare
  raw text;
  code text;
begin
  -- hex is [0-9a-f], so we upper-case it for nicer codes.
  raw := encode(gen_random_bytes(16), 'hex');
  code := upper(substr(raw, 1, greatest(8, least(code_len, 32))));
  return code;
end;
$$;

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  hid uuid;
  code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Household name required';
  end if;

  insert into public.households (name, created_by)
  values (trim(p_name), auth.uid())
  returning household_id into hid;

  -- Creator becomes owner.
  insert into public.household_members (household_id, user_id, role)
  values (hid, auth.uid(), 'owner');

  -- Create unique invite code.
  loop
    code := public._generate_invite_code(10);
    begin
      insert into public.household_invites (household_id, invite_code)
      values (hid, code);
      exit;
    exception when unique_violation then
      -- try again
      null;
    end;
  end loop;

  return hid;
end;
$$;

comment on function public.create_household(text) is 
  'Creates a new household and makes the caller the owner. Returns household_id.';

create or replace function public.rotate_household_invite(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_household_admin(p_household_id) then
    raise exception 'Not allowed';
  end if;

  loop
    code := public._generate_invite_code(10);
    begin
      update public.household_invites
        set invite_code = code,
            rotated_at = now()
      where household_id = p_household_id;

      if not found then
        insert into public.household_invites (household_id, invite_code, rotated_at)
        values (p_household_id, code, now());
      end if;

      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  return code;
end;
$$;

comment on function public.rotate_household_invite(uuid) is 
  'Generates a new invite code for the household. Only admins can call this. Returns new code.';

create or replace function public.join_household(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_invite_code is null or length(trim(p_invite_code)) = 0 then
    raise exception 'Invite code required';
  end if;

  select household_id
    into hid
  from public.household_invites
  where invite_code = trim(p_invite_code);

  if hid is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (hid, auth.uid(), 'member')
  on conflict do nothing;

  return hid;
end;
$$;

comment on function public.join_household(text) is 
  'Join a household using an invite code. Returns household_id. Enforces one-household-per-user constraint.';

create or replace function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Owners must transfer ownership before leaving.
  if public.is_household_owner(p_household_id) then
    raise exception 'Owner cannot leave. Transfer ownership first.';
  end if;

  delete from public.household_members
  where household_id = p_household_id
    and user_id = auth.uid();
end;
$$;

comment on function public.leave_household(uuid) is 
  'Leave a household. Owners must transfer ownership before leaving.';

-- Grant execute permissions
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.rotate_household_invite(uuid) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;

-----------------------------
-- 10) Grant permissions on views
-----------------------------
grant select on public.chores_with_details to authenticated;
grant select on public.user_chores to authenticated;
grant select on public.household_machines to authenticated;

-----------------------------
-- SETUP COMPLETE
-----------------------------
-- Next steps:
-- 1. Run this script in Supabase SQL Editor
-- 2. Enable Supabase Auth in your project settings
-- 3. Create frontend helper functions to:
--    - Convert date strings ↔ timestamptz
--    - Convert peopleAssigned array ↔ chore_assignments table
--    - Convert repeatDays array ↔ bitmask integer
--    - Map field names (content→text, sent_at→createdAt, etc.)
-- 4. Use the provided views (chores_with_details, household_machines) for easier queries
