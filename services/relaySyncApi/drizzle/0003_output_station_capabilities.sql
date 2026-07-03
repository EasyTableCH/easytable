ALTER TABLE catalog_output_stations ADD COLUMN IF NOT EXISTS has_kds integer DEFAULT 0 NOT NULL;
ALTER TABLE catalog_output_stations ADD COLUMN IF NOT EXISTS has_printer integer DEFAULT 0 NOT NULL;

UPDATE catalog_output_stations
SET
  has_kds = CASE WHEN kind IN ('KDS', 'KDS_AND_PRINTER') THEN 1 ELSE has_kds END,
  has_printer = CASE WHEN kind IN ('PRINTER', 'KDS_AND_PRINTER') THEN 1 ELSE has_printer END;
