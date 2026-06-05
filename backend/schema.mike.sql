-- Mike schema migration for the SHARED Supabase project (qoigdhqwcmcryvtzltwd / ai-law-firm).
--
-- This is a SAFE, isolated variant of schema.sql:
--   * All 16 Mike tables live in a dedicated `mike` Postgres schema (NOT public),
--     so they cannot collide with the existing lina-os-front `public.documents` /
--     `public.document_versions` tables (which have an incompatible structure).
--   * The signup trigger is named `on_auth_user_created_mike` and is ADDED alongside
--     the existing `on_auth_user_created` trigger. The existing trigger is NOT dropped.
--   * Browser roles (anon/authenticated) get schema USAGE only, never table privileges.
--     Mike's backend reaches these tables exclusively via the service_role key.
--
-- Requires (one-time, separate step): add `mike` to the project's PostgREST
-- "Exposed schemas" list, otherwise supabase-js cannot reach it.

create extension if not exists "pgcrypto";

create schema if not exists mike;

-- ---------------------------------------------------------------------------
-- User profiles
-- ---------------------------------------------------------------------------

create table if not exists mike.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  organisation text,
  tier text not null default 'Free',
  message_credits_used integer not null default 0,
  credits_reset_date timestamptz not null default (now() + interval '30 days'),
  tabular_model text not null default 'gemini-3-flash-preview',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_user
  on mike.user_profiles(user_id);

create or replace function mike.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = mike
as $$
begin
  insert into mike.user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
exception when others then
  -- Never block signup if the profile insert fails.
  return new;
end;
$$;

-- ADDED alongside the existing on_auth_user_created trigger (which is left intact).
drop trigger if exists on_auth_user_created_mike on auth.users;
create trigger on_auth_user_created_mike
  after insert on auth.users
  for each row execute procedure mike.handle_new_user();

create table if not exists mike.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('claude', 'gemini', 'openai')),
  encrypted_key text not null,
  iv text not null,
  auth_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

create index if not exists idx_user_api_keys_user
  on mike.user_api_keys(user_id);

-- ---------------------------------------------------------------------------
-- Projects and documents
-- ---------------------------------------------------------------------------

create table if not exists mike.projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  cm_number text,
  visibility text not null default 'private',
  shared_with jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user
  on mike.projects(user_id);

create index if not exists projects_shared_with_idx
  on mike.projects using gin (shared_with);

create table if not exists mike.project_subfolders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references mike.projects(id) on delete cascade,
  user_id text not null,
  name text not null,
  parent_folder_id uuid references mike.project_subfolders(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_subfolders_project
  on mike.project_subfolders(project_id);

create table if not exists mike.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references mike.projects(id) on delete cascade,
  user_id text not null,
  filename text not null,
  file_type text,
  size_bytes integer not null default 0,
  page_count integer,
  structure_tree jsonb,
  status text not null default 'pending',
  folder_id uuid references mike.project_subfolders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_user_project
  on mike.documents(user_id, project_id);

create index if not exists idx_documents_project_folder
  on mike.documents(project_id, folder_id);

create table if not exists mike.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references mike.documents(id) on delete cascade,
  storage_path text not null,
  pdf_storage_path text,
  source text not null default 'upload',
  version_number integer,
  display_name text,
  created_at timestamptz not null default now(),
  constraint document_versions_source_check
    check (source = any (array[
      'upload'::text,
      'user_upload'::text,
      'assistant_edit'::text,
      'user_accept'::text,
      'user_reject'::text,
      'generated'::text
    ]))
);

create index if not exists document_versions_document_id_idx
  on mike.document_versions(document_id, created_at desc);

create index if not exists document_versions_doc_vnum_idx
  on mike.document_versions(document_id, version_number);

alter table mike.documents
  add column if not exists current_version_id uuid
  references mike.document_versions(id) on delete set null;

create table if not exists mike.document_edits (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references mike.documents(id) on delete cascade,
  chat_message_id uuid,
  version_id uuid not null references mike.document_versions(id) on delete cascade,
  change_id text not null,
  del_w_id text,
  ins_w_id text,
  deleted_text text not null default '',
  inserted_text text not null default '',
  context_before text,
  context_after text,
  status text not null default 'pending'
    check (status = any (array[
      'pending'::text,
      'accepted'::text,
      'rejected'::text
    ])),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists document_edits_document_id_idx
  on mike.document_edits(document_id, created_at desc);

create index if not exists document_edits_message_id_idx
  on mike.document_edits(chat_message_id);

create index if not exists document_edits_version_id_idx
  on mike.document_edits(version_id);

-- ---------------------------------------------------------------------------
-- Workflows
-- ---------------------------------------------------------------------------

create table if not exists mike.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  title text not null,
  type text not null,
  prompt_md text,
  columns_config jsonb,
  practice text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflows_user
  on mike.workflows(user_id);

create table if not exists mike.hidden_workflows (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  workflow_id text not null,
  created_at timestamptz not null default now(),
  unique(user_id, workflow_id)
);

create index if not exists idx_hidden_workflows_user
  on mike.hidden_workflows(user_id);

create table if not exists mike.workflow_shares (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references mike.workflows(id) on delete cascade,
  shared_by_user_id text not null,
  shared_with_email text not null,
  allow_edit boolean not null default false,
  created_at timestamptz not null default now(),
  constraint workflow_shares_workflow_email_unique
    unique(workflow_id, shared_with_email)
);

create index if not exists workflow_shares_workflow_id_idx
  on mike.workflow_shares(workflow_id);

create index if not exists workflow_shares_email_idx
  on mike.workflow_shares(shared_with_email);

-- ---------------------------------------------------------------------------
-- Assistant chats
-- ---------------------------------------------------------------------------

create table if not exists mike.chats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references mike.projects(id) on delete cascade,
  user_id text not null,
  title text,
  created_at timestamptz not null default now()
);

create index if not exists idx_chats_user
  on mike.chats(user_id);

create index if not exists idx_chats_project
  on mike.chats(project_id);

create table if not exists mike.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references mike.chats(id) on delete cascade,
  role text not null,
  content jsonb,
  files jsonb,
  annotations jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_chat
  on mike.chat_messages(chat_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_edits_chat_message_id_fkey'
      and conrelid = 'mike.document_edits'::regclass
  ) then
    alter table mike.document_edits
      add constraint document_edits_chat_message_id_fkey
      foreign key (chat_message_id)
      references mike.chat_messages(id)
      on delete set null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabular reviews
-- ---------------------------------------------------------------------------

create table if not exists mike.tabular_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references mike.projects(id) on delete cascade,
  user_id text not null,
  title text,
  columns_config jsonb,
  document_ids jsonb,
  workflow_id uuid references mike.workflows(id) on delete set null,
  practice text,
  shared_with jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tabular_reviews_user
  on mike.tabular_reviews(user_id);

create index if not exists idx_tabular_reviews_project
  on mike.tabular_reviews(project_id);

create index if not exists tabular_reviews_shared_with_idx
  on mike.tabular_reviews using gin (shared_with);

create table if not exists mike.tabular_cells (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references mike.tabular_reviews(id) on delete cascade,
  document_id uuid not null references mike.documents(id) on delete cascade,
  column_index integer not null,
  content text,
  citations jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_tabular_cells_review
  on mike.tabular_cells(review_id, document_id, column_index);

create table if not exists mike.tabular_review_chats (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references mike.tabular_reviews(id) on delete cascade,
  user_id text not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tabular_review_chats_review_idx
  on mike.tabular_review_chats(review_id, updated_at desc);

create index if not exists tabular_review_chats_user_idx
  on mike.tabular_review_chats(user_id);

create table if not exists mike.tabular_review_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references mike.tabular_review_chats(id) on delete cascade,
  role text not null,
  content jsonb,
  annotations jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tabular_review_chat_messages_chat_idx
  on mike.tabular_review_chat_messages(chat_id, created_at);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Mike's backend talks to these tables only via the service_role key. The
-- browser (anon/authenticated) uses Supabase solely for auth and must NOT get
-- direct row access — so it receives schema USAGE only, never table privileges.

grant usage on schema mike to anon, authenticated, service_role, postgres;

grant all on all tables in schema mike to service_role, postgres;
grant all on all sequences in schema mike to service_role, postgres;

alter default privileges in schema mike
  grant all on tables to service_role, postgres;
alter default privileges in schema mike
  grant all on sequences to service_role, postgres;
