-- Seed data for RefillRx: Mani, Benin City.
--
-- Idempotent: applying this file repeatedly keeps one row per
-- (name, brand, strength) combination and never changes anything else.
-- Prices are the pharmacist-confirmed reference prices from drugs.ts.
-- They are private data: patients never see them until the pharmacist
-- adds a confirmed price to their order.

-- 1. Pharmacy settings --------------------------------------------------------

insert into public.pharmacy_settings (id, name, city, phone, whatsapp, opening_hours)
values (
  true,
  'Mani',
  'Benin City',
  '+2349061426386',
  '+2349061426386',
  '{"monday": "07:00 - 18:00", "tuesday": "07:00 - 18:00", "wednesday": "07:00 - 18:00", "thursday": "07:00 - 18:00", "friday": "07:00 - 18:00", "saturday": "07:00 - 18:00", "sunday": "07:00 - 18:00"}'::jsonb
)
on conflict (id) do update
  set name = excluded.name,
      city = excluded.city,
      phone = excluded.phone,
      whatsapp = excluded.whatsapp,
      opening_hours = excluded.opening_hours,
      updated_at = now();

-- 2. Medicines -----------------------------------------------------------------

do $$
declare
  want record;
  existing uuid;
begin
  for want in
    select * from (values
      ('Paracetamol',            'Emzor',    '500mg',    '20 tablets',  'Tablet',   'Pain Relief',            800.00,  false),
      ('Paracetamol',            'Panadol',  '500mg',    '24 tablets',  'Tablet',   'Pain Relief',            1800.00, false),
      ('Ibuprofen',              'Emzor',    '400mg',    '20 tablets',  'Tablet',   'Pain Relief',            1200.00, false),
      ('Amoxicillin',            'Emzor',    '500mg',    '20 capsules', 'Capsule',  'Antibiotics',            2500.00, true),
      ('Metronidazole',          'Emzor',    '400mg',    '20 tablets',  'Tablet',   'Antibiotics',            1000.00, true),
      ('Artemether/Lumefantrine','Lonart',   '20/120mg', '24 tablets',  'Tablet',   'Antimalarial',           2800.00, false),
      ('Artemether/Lumefantrine','Coartem',  '20/120mg', '24 tablets',  'Tablet',   'Antimalarial',           6500.00, false),
      ('Cetirizine',             'Emzor',    '10mg',     '10 tablets',  'Tablet',   'Allergy',                700.00,  false),
      ('Loratadine',             'Clarityn', '10mg',     '10 tablets',  'Tablet',   'Allergy',                2200.00, false),
      ('Omeprazole',             'Emzor',    '20mg',     '14 capsules', 'Capsule',  'Gastrointestinal',       1400.00, false),
      ('ORS Sachets',            'Emzor',    null,       '10 sachets',  'Powder',   'Rehydration',            1200.00, false),
      ('Vitamin C',              'Emzor',    '1000mg',   '20 tablets',  'Tablet',   'Vitamins',               1500.00, false),
      ('Ferrous Sulphate',       'Emzor',    '200mg',    '30 tablets',  'Tablet',   'Vitamins & Supplements', 1000.00, false),
      ('Folic Acid',             'Emzor',    '5mg',      '30 tablets',  'Tablet',   'Vitamins & Supplements', 800.00,  false),
      ('Zinc Sulphate',          'Emzor',    '20mg',     '20 tablets',  'Tablet',   'Vitamins & Supplements', 900.00,  false),
      ('Multivitamin Tablets',   'Centrum',  null,       '30 tablets',  'Tablet',   'Vitamins & Supplements', 8500.00, false),
      ('Diclofenac',             'Emzor',    '50mg',     '20 tablets',  'Tablet',   'Pain Relief',            1100.00, false),
      ('Amlodipine',             'Emzor',    '5mg',      '30 tablets',  'Tablet',   'Blood Pressure',         1200.00, true),
      ('Losartan',               'Cozaar',   '50mg',     '28 tablets',  'Tablet',   'Blood Pressure',         4500.00, true),
      ('Salbutamol',             'Ventolin', '4mg',      '30 tablets',  'Tablet',   'Respiratory',            1800.00, true),
      ('Salbutamol',             'Ventolin', '100mcg',   '1 inhaler',   'Inhaler',  'Respiratory',            6500.00, true),
      ('Cough Syrup',            'Benylin',  null,       '100ml',       'Syrup',    'Cough & Cold',           2800.00, false),
      ('Antacid Suspension',     'Gestid',   null,       '200ml',       'Suspension','Gastrointestinal',      2200.00, false),
      ('Miconazole',             'Daktarin', '2%',       '15g',         'Cream',    'Antifungal',             3200.00, false),
      ('Hydrocortisone',         'Generic',  '1%',       '15g',         'Cream',    'Skin Care',              900.00,  false),
      ('Chloramphenicol',        'Generic',  null,       '10ml',        'Eye Drops','Eye Care',               1200.00, true)
    ) as d(name, brand, strength, pack_size, dosage_form, category, price, rx)
  loop
    select id into existing from public.medicines
    where name = want.name and brand = want.brand and coalesce(strength, '') = coalesce(want.strength, '')
    limit 1;

    if existing is null then
      insert into public.medicines (name, brand, strength, pack_size, dosage_form, category, requires_prescription, reference_price_ngn)
      values (want.name, want.brand, want.strength, want.pack_size, want.dosage_form, want.category, want.rx, want.price);
    else
      update public.medicines
      set pack_size = want.pack_size,
          dosage_form = want.dosage_form,
          category = want.category,
          requires_prescription = want.rx,
          active = true,
          updated_at = now()
      where id = existing;
      update public.medicines
      set reference_price_ngn = want.price,
          updated_at = now()
      where id = existing and reference_price_ngn is null;
    end if;
  end loop;
end $$;

-- 3. Demo accounts ---------------------------------------------------------------
--
-- auth.users rows cannot be seeded through plain SQL safely; create the demo
-- accounts through the Supabase Dashboard (Authentication > Add user) or the
-- Admin API, then assign roles:
--
--   Patient demo ("Amina"):        create normally via /sign-up
--   Pharmacist (Mani pharmacist):  set profiles.role = 'pharmacist'; and
--     update auth.users
--     set raw_app_meta_data = jsonb_set(
--       coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', '"pharmacist"'::jsonb
--     );
--   The pharmacist must sign out and sign back in so the JWT claim refreshes.
