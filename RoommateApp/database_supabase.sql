-- RoommatePlus (Supabase) schema
--
-- Goal: remove DIY auth (email/password in AppUser) and use Supabase Auth (auth.users).
--
-- This script:
--   * Drops your old public tables (household/appuser/machine/chore/userchore/thread/message)
--   * Creates new tables keyed by auth.users.id (UUID)
--   * Enables RLS everywhere and adds policies for authenticated users only
--   * Adds SECURITY DEFINER RPC functions for safe household creation and joining
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
drop table if exists public.message cascade;
drop table if exists public.thread cascade;
drop table if exists public.userchore cascade;
drop table if exists public.chore cascade;
drop table if exists public.machine cascade;
drop table if exists public.appuser cascade;
drop table if exists public.household cascade;

drop type if exists public.chore_status cascade;
drop type if exists public.repeat_unit cascade;
drop type if exists public.machine_status cascade;
drop type if exists public.household_role cascade;

-----------------------------
-- 2) Enums
-----------------------------
create type public.chore_status as enum ('incomplete', 'late', 'completed', 'abandoned');
create type public.repeat_unit as enum ('none', 'daily', 'weekly', 'monthly');
create type public.machine_status as enum ('available', 'in_use', 'maintenance');
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

create table public.household_members (
  household_id uuid not null references public.households(household_id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         public.household_role not null default 'member',
  joined_at    timestamptz not null default now(),

  primary key (household_id, user_id)
);

create index idx_household_members_user_id on public.household_members(user_id);

create table public.machines (
  machine_id   uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id) on delete cascade,
  name         text not null,
  image_url    text,
  status       public.machine_status not null default 'available',
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint chk_machine_name_nonempty check (length(trim(name)) > 0)
);

create unique index uq_machines_name_per_household on public.machines (household_id, lower(name));
create index idx_machines_household_id on public.machines(household_id);

create trigger trg_machines_updated_at
before update on public.machines
for each row execute function public.set_updated_at();

create table public.chores (
  chore_id     uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id) on delete cascade,
  machine_id   uuid references public.machines(machine_id) on delete set null,

  title        text not null,
  description  text,
  due_at       timestamptz,

  status       public.chore_status not null default 'incomplete',

  -- Repeat scheduling
  repeat_unit     public.repeat_unit not null default 'none',
  repeat_interval integer not null default 1,
  repeat_days     smallint not null default 0, -- only used when repeat_unit='weekly'

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

  -- repeat_days rules:
  -- - if not weekly -> must be 0
  -- - if weekly -> must be 1..127 (at least one day selected)
  constraint chk_repeat_days_weekly
    check (
      (repeat_unit <> 'weekly' and repeat_days = 0)
      or
      (repeat_unit = 'weekly' and repeat_days between 1 and 127)
    )
);

create index idx_chores_household_id on public.chores(household_id);
create index idx_chores_machine_id on public.chores(machine_id);
create index idx_chores_due_at on public.chores(due_at);
create index idx_chores_created_by on public.chores(created_by);

create trigger trg_chores_updated_at
before update on public.chores
for each row execute function public.set_updated_at();

-- Many-to-many assignments (supports multiple assignees)
create table public.chore_assignments (
  chore_id     uuid not null references public.chores(chore_id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  assigned_by  uuid references auth.users(id) on delete set null default auth.uid(),
  assigned_at  timestamptz not null default now(),

  primary key (chore_id, user_id)
);

create index idx_chore_assignments_user_id on public.chore_assignments(user_id);

create table public.threads (
  thread_id    uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id) on delete cascade,
  chore_id     uuid references public.chores(chore_id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete restrict default auth.uid(),
  ai_summary   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_threads_household_id on public.threads(household_id);
create index idx_threads_chore_id on public.threads(chore_id);

create trigger trg_threads_updated_at
before update on public.threads
for each row execute function public.set_updated_at();

create table public.messages (
  message_id uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.threads(thread_id) on delete cascade,
  sender_id  uuid references auth.users(id) on delete set null default auth.uid(),
  content    text not null,
  sent_at    timestamptz not null default now(),

  constraint chk_message_content_nonempty check (length(trim(content)) > 0)
);

create index idx_messages_thread_id on public.messages(thread_id);
create index idx_messages_sender_id on public.messages(sender_id);

-----------------------------
-- 6) Helper auth/rls functions
-----------------------------
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
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

-- Machines: members can read; admins can mutate.
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

drop policy if exists "machines_update_admin" on public.machines;
create policy "machines_update_admin"
  on public.machines
  for update
  to authenticated
  using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

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
-- 8) RPC functions (safe household create/join)
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

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.rotate_household_invite(uuid) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;

