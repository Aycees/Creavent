-- The platform-wide product categories (spec §4.1, data model §5.3). They are
-- reference data every environment needs, so they ship as a migration. A
-- category is never deleted, only made inactive.
INSERT INTO "categories" ("id", "name", "slug", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'Preloved clothing', 'preloved-clothing', 1, now()),
  (gen_random_uuid(), 'Vintage', 'vintage', 2, now()),
  (gen_random_uuid(), 'Handmade and crafts', 'handmade-and-crafts', 3, now()),
  (gen_random_uuid(), 'Food and drinks', 'food-and-drinks', 4, now()),
  (gen_random_uuid(), 'Plants', 'plants', 5, now()),
  (gen_random_uuid(), 'Books and toys', 'books-and-toys', 6, now()),
  (gen_random_uuid(), 'Other', 'other', 7, now());
