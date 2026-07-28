-- Enable RLS on all tables
alter table walls enable row level security;
alter table notes enable row level security;
alter table note_templates enable row level security;
alter table _screenshot_cache enable row level security;

-- Walls: anyone can read
create policy "Anyone can read walls"
  on walls for select
  using (true);

-- Walls: anyone can insert
create policy "Anyone can insert walls"
  on walls for insert
  with check (true);

-- Notes: anyone can read
create policy "Anyone can read notes"
  on notes for select
  using (true);

-- Notes: anyone can insert
create policy "Anyone can insert notes"
  on notes for insert
  with check (true);

-- Note templates: anyone can read
create policy "Anyone can read note_templates"
  on note_templates for select
  using (true);

-- Screenshot cache: anyone can read/insert/update
create policy "Anyone can read screenshot_cache"
  on _screenshot_cache for select
  using (true);

create policy "Anyone can insert screenshot_cache"
  on _screenshot_cache for insert
  with check (true);

create policy "Anyone can update screenshot_cache"
  on _screenshot_cache for update
  using (true);
