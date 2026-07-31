-- Walls: anyone can update (server validates edit_token before calling)
create policy "Anyone can update walls"
  on walls for update
  using (true);
