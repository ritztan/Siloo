-- =====================================================================
-- Silo · sample data (same names the dashboard shows in demo mode)
-- Safe to skip in production. Run AFTER all the migrations.
-- =====================================================================

insert into public.farmers (id, farm_name, contact_name, email, location, status) values
  ('11111111-0000-0000-0000-000000000001', 'Navarro Family Farm',     'Lito Navarro',  'navarro@example.com',   'Nueva Ecija', 'approved'),
  ('11111111-0000-0000-0000-000000000002', 'Aquino Highland Greens',  'Rosa Aquino',   'aquino@example.com',    'Benguet',     'approved'),
  ('11111111-0000-0000-0000-000000000003', 'Santos Organic Farm',     'Ben Santos',    'santos@example.com',    'Bulacan',     'approved'),
  ('11111111-0000-0000-0000-000000000004', 'Riverside Organics',      'Mia Reyes',     'riverside@example.com', 'Laguna',      'approved'),
  ('11111111-0000-0000-0000-000000000005', 'Dela Cruz Vegetable Farm','Jun Dela Cruz', 'delacruz@example.com',  'Tarlac',      'pending'),
  ('11111111-0000-0000-0000-000000000006', 'Bautista Fruit Orchard',  'Ana Bautista',  'bautista@example.com',  'Batangas',    'pending'),
  ('11111111-0000-0000-0000-000000000007', 'Mendoza Rice Fields',     'Paolo Mendoza', 'mendoza@example.com',   'Pampanga',    'pending');

insert into public.recipients (id, name, type, contact_name, address, capacity, needs, status) values
  ('22222222-0000-0000-0000-000000000001', 'Hope Kitchen',   'kitchen',   'Grace Lim',      'Sampaloc, Manila', '120 meals / day', 'Fruit, vegetables', 'open'),
  ('22222222-0000-0000-0000-000000000002', 'Food Bank 1',    'food_bank', 'Mark Tan',       'Quezon City',      '350 households',  'Root vegetables',   'open'),
  ('22222222-0000-0000-0000-000000000003', 'City Pantry',    'pantry',    'Joy Ramos',      'Ermita, Manila',   '80 households',   'Fresh produce',     'open'),
  ('22222222-0000-0000-0000-000000000004', 'Second Harvest', 'food_bank', 'Leo Villanueva', 'Pasig City',       '200 meals / day', 'Leafy greens',      'limited');

insert into public.volunteers (id, full_name, email, phone, service_area, vehicle_type, capacity_kg) values
  ('33333333-0000-0000-0000-000000000001', 'Jessa Cruz',   'jessa@example.com',  '0917 000 0001', 'Sampaloc, Manila', 'van',    500),
  ('33333333-0000-0000-0000-000000000002', 'Rafael Gomez', 'rafael@example.com', '0917 000 0002', 'Quezon City',      'pickup', 300),
  ('33333333-0000-0000-0000-000000000003', 'Kim Torres',   'kim@example.com',    '0917 000 0003', 'Pasig City',       'car',    80);

insert into public.donations (id, produce, quantity_kg, farmer_id, recipient_id, status, expires_at, delivered_at, created_by, created_at) values
  ('44444444-0000-0000-0000-000000000001', 'Peaches',        40, '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'pickup_scheduled', now() + interval '2 days',  null, null, now() - interval '1 day'),
  ('44444444-0000-0000-0000-000000000002', 'Sweet potatoes', 28, '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'pickup_scheduled',          now() + interval '5 days',  null, null, now() - interval '6 hours'),
  ('44444444-0000-0000-0000-000000000003', 'Tomatoes',       16, '11111111-0000-0000-0000-000000000003', null,                                   'new',              now() + interval '3 hours', null, null, now() - interval '1 hour'),
  ('44444444-0000-0000-0000-000000000004', 'Leafy greens',   22, '11111111-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000004', 'delivered',        null, now() - interval '1 day',  null, now() - interval '2 days'),
  ('44444444-0000-0000-0000-000000000005', 'Calamansi',      35, '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', 'delivered',        null, now() - interval '3 days', null, now() - interval '4 days'),
  ('44444444-0000-0000-0000-000000000006', 'Eggplant',       18, '11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', 'delivered',        null, now() - interval '5 days', null, now() - interval '6 days');

insert into public.pickups (donation_id, volunteer_id, scheduled_at, status) values
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', date_trunc('day', now()) + interval '10 hours 30 minutes', 'scheduled'),
  ('44444444-0000-0000-0000-000000000002', null,                                   date_trunc('day', now()) + interval '14 hours',             'scheduled'),
  ('44444444-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000002', now() - interval '1 day',                                    'completed');
