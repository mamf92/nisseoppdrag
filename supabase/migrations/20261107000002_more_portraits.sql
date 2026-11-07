-- Nisseoppdrag: two more portraits, so every character has at least two (Martin, 2026-11-07):
-- the barn cat asleep and the barn mouse with the ladle, cropped from sheet L-07.
-- The drawn nisse is no longer offered; a player without a choice gets a default portrait
-- picked in the app from the member id, so nothing changes in the database for that.
insert into public.portraits (id, sort) values
  ('fjoskatten-2', 20), ('musa-2', 21);
