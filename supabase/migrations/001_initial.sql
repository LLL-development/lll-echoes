-- Walls table
create table walls (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  edit_token text not null,
  mode text not null check (mode in ('ORGANIZATION', 'PUBLIC')),
  theme text not null default 'testimonials',
  created_at timestamptz not null default now()
);

-- Note templates table
create table note_templates (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id) on delete cascade,
  name text not null,
  style jsonb not null default '{}',
  is_default boolean not null default false
);

-- Notes table
create table notes (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id) on delete cascade,
  image_url text,
  x int not null default 0,
  y int not null default 0,
  width int not null default 200,
  height int not null default 150,
  rotation int not null default 0,
  template_id uuid references note_templates(id),
  author_session_id text,
  author_name text,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_notes_wall on notes(wall_id);
create index idx_templates_wall on note_templates(wall_id);

-- Default templates for testimonials theme
insert into note_templates (wall_id, name, style, is_default)
select id, 'Simple Card', '{"backgroundColor":"#ffffff","borderColor":"#e2e8f0","borderWidth":1,"borderRadius":8,"shadow":"0 1px 3px rgba(0,0,0,0.1)","fontFamily":"sans-serif","accentColor":"#3b82f6"}', true
from walls;
