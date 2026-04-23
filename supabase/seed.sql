-- Ky skedar perdoret per te mbushur databazen me te dhena fillestare (seeding).
-- Ekzekutohet vetem kur databaza krijohet nga e para ose kur perdoret komanda 'supabase db reset'.

-- 1. Pastron te gjithe artikujt ekzistues te menuse per te shmangur dublikimet.
DELETE FROM public.menu;

-- 2. Shton listen e re te produkteve te menuse.
INSERT INTO public.menu (name, category, price, description, active, image, restaurant_id)
VALUES
  ('Supë Viçi', 'supat', 3.50, 'Mish viçi, perime freskëta, erëza', true, '', 1),
  ('Supë Peshku', 'supat', 4.50, 'Peshk i freskët, limon, majdanoz', true, '', 1),
  ('Sanduiç Pule', 'senduic', 3.00, 'Gjoks pule, sallatë, sos shtëpie', true, '', 1),
  ('Sanduiç Viçi', 'senduic', 4.00, 'Mish viçi, djathë, speca', true, '', 1),
  ('Chicken Quesadilla', 'senduic', 4.50, 'Tortilla, pule, djathë i shkrirë, sos', true, '', 1),
  ('Burger Klasik', 'burger', 4.50, 'Mish viçi 100%, sallatë, domate, qepë', true, '', 1),
  ('Burger Pule', 'burger', 4.00, 'Pule e panuar, majonezë, sallatë', true, '', 1),
  ('Rizoto Fruta Deti', 'rizoto', 7.50, 'Oriz arborio, karkaleca, midhje, sepje', true, '', 1),
  ('Rizoto Beef Cubes', 'rizoto', 8.50, 'Oriz, copëza mishi viçi, kërpudha', true, '', 1),
  ('Pasta Carbonara', 'pasta', 6.00, 'Pana, pançetë, vezë, parmixhano', true, '', 1),
  ('Pasta Boloneze', 'pasta', 5.50, 'Salcë domatesh, mish i bluar, erëza', true, '', 1),
  ('Pica Margarita', 'pica', 4.50, 'Salcë domate, mocarela, borzilok', true, '', 1),
  ('Pica Proshute', 'pica', 5.50, 'Salcë domate, mocarela, proshutë vici', true, '', 1),
  ('Gordon Blue', 'pule', 7.50, 'Fileto pule e mbushur me djathë dhe proshutë', true, '', 1),
  ('Fileto Pule Pesto', 'pule', 6.50, 'Gjoks pule, sos pesto, parmixhano', true, '', 1),
  ('Biftek Viçi', 'misherat', 14.00, 'Biftek premium, gjalpë, rozmarinë', true, '', 1),
  ('Pleskavicë në Skarë', 'misherat', 5.00, 'Mish i bluar vici, qepë, ajvar', true, '', 1),
  ('Tiramisu', 'desert', 3.50, 'Maskarpone, kafe, biskota', true, '', 1),
  ('Trileçe', 'desert', 3.00, 'Tre lloje qumështi, karamel', true, '', 1),
  ('Nutella Cake', 'desert', 4.00, 'Nutella origjinale, lajthi', true, '', 1);
