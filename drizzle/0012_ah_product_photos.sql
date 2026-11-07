-- Ingredients linked to an AH product before the product image became the ingredient photo get it now.
-- Same rule as linkAhProduct: household ingredients, and shared ingredients only via an admin's household.
UPDATE "ingredient" AS i
SET "photo" = jsonb_build_object(
    'url', l."image_url",
    'sourceUrl', 'https://www.ah.nl/producten/product/wi' || l."product_id",
    'credit', 'Albert Heijn',
    'licenseUrl', NULL
  ),
  "updated_at" = now()
FROM (
  SELECT DISTINCT ON (link."ingredient_id") link.*
  FROM "ingredient_ah_product" AS link
  JOIN "ingredient" AS target ON target."id" = link."ingredient_id"
  WHERE link."image_url" LIKE 'https://%'
    AND (
      target."household_id" = link."household_id"
      OR (
        target."household_id" IS NULL
        AND EXISTS (
          SELECT 1 FROM "membership" AS m JOIN "user" AS u ON u."id" = m."user_id"
          WHERE m."household_id" = link."household_id" AND u."role" = 'admin'
        )
      )
    )
  ORDER BY link."ingredient_id", link."updated_at" DESC
) AS l
WHERE i."id" = l."ingredient_id" AND i."photo" IS NULL;
