DELETE FROM `catalog_output_stations`
WHERE `tenant_id` = 'tenant_basilica'
  AND `id` IN ('station_shisha', 'station_bar', 'station_snack')
  AND NOT EXISTS (
    SELECT 1
    FROM `catalog_products`
    WHERE `catalog_products`.`station_id` = `catalog_output_stations`.`id`
  );
