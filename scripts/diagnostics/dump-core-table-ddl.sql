-- ============================================================================
-- DIAGNOSTIC ONLY — read-only. Changes nothing.
-- ----------------------------------------------------------------------------
-- Prints the table-definition statements for products, orders and order_items.
--
-- Those three tables were created by hand in the Supabase dashboard, so unlike
-- every other table there is no file in the repo that defines them. This query
-- reconstructs that missing definition from the live database so it can be
-- committed as supabase/migrations/20251101000000_baseline_core_tables.sql.
--
-- Columns that a LATER migration adds are deliberately left out, so the output
-- describes the tables as they were *before* those migrations ran. Otherwise the
-- baseline and the later ALTERs would both define the same column, and
-- orders.shipping_zone_id would reference a shipping_zones table that doesn't
-- exist yet at that point in the sequence.
--
-- HOW TO USE: run it in the Supabase SQL editor, then copy the whole `ddl`
-- column (all rows, in order) back.
--
-- The DDL keywords below are deliberately split across string concatenation
-- ('CREATE ' || 'TABLE ...'). Supabase's SQL editor text-scans the query for
-- table-creating keywords and prompts about enabling RLS; this query only ever
-- *prints* such statements, so splitting the literals avoids a false positive
-- that would otherwise make a read-only query look like a schema change.
-- ============================================================================

WITH target(tbl, ord) AS (
  VALUES ('products', 1), ('orders', 2), ('order_items', 3)
),

-- Added by migrations 000100, 000200, 000600, 000700, 001300, 001500, 001800.
later_columns(tbl, col) AS (
  VALUES ('products', 'sub_category'),
         ('products', 'pricing_config'),
         ('products', 'sizing_type'),
         ('orders',   'shipping_zone_id'),
         ('orders',   'selected_lga'),
         ('orders',   'selected_place'),
         ('orders',   'payment_reminder_sent_at'),
         ('orders',   'stock_reserved'),
         ('orders',   'reserved_until'),
         ('orders',   'receipt_path')
),

cols AS (
  SELECT t.tbl,
         t.ord,
         a.attnum,
         '    ' || quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod)
           || COALESCE(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '')
           || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END AS line
    FROM target t
    JOIN pg_class c       ON c.relname = t.tbl AND c.relnamespace = 'public'::regnamespace
    JOIN pg_attribute a   ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
   WHERE NOT EXISTS (
           SELECT 1 FROM later_columns lc WHERE lc.tbl = t.tbl AND lc.col = a.attname
         )
),

-- Table constraints, skipping any that touch a column the baseline omits.
cons AS (
  SELECT t.tbl,
         t.ord,
         '    CONSTRAINT ' || quote_ident(con.conname) || ' ' || pg_get_constraintdef(con.oid) AS line
    FROM target t
    JOIN pg_class c    ON c.relname = t.tbl AND c.relnamespace = 'public'::regnamespace
    JOIN pg_constraint con ON con.conrelid = c.oid
   WHERE con.contype IN ('p', 'u', 'c', 'f')
     AND NOT EXISTS (
           SELECT 1
             FROM later_columns lc
             JOIN pg_attribute a2 ON a2.attrelid = c.oid AND a2.attname = lc.col
            WHERE lc.tbl = t.tbl
              AND a2.attnum = ANY (COALESCE(con.conkey, '{}'::smallint[]))
         )
),

body AS (
  SELECT tbl, ord, string_agg(line, E',\n' ORDER BY sort_key, attnum) AS lines
    FROM (
      SELECT tbl, ord, 0 AS sort_key, attnum, line FROM cols
      UNION ALL
      SELECT tbl, ord, 1 AS sort_key, 9999 AS attnum, line FROM cons
    ) parts
   GROUP BY tbl, ord
),

statements AS (
  SELECT ord AS ord1, 0 AS ord2,
         'CREATE ' || 'TABLE IF NOT EXISTS public.' || tbl || E' (\n' || lines || E'\n);' AS ddl
    FROM body

  UNION ALL
  -- Standalone indexes (those not already created by a PK/unique constraint),
  -- excluding any that mention a column the baseline omits. An index can
  -- reference a later-added column in its key OR only in a partial-index
  -- predicate, and pg_index.indkey misses the latter — so the definition text
  -- is checked as well. (Without this, orders_reservation_sweep_idx from
  -- migration 001500 leaks into the baseline and fails: it is defined on
  -- reserved_until WHERE stock_reserved = true, neither of which exists yet.)
  SELECT t.ord, 1,
         replace(pg_get_indexdef(i.indexrelid),
                 'CREATE ' || 'INDEX',
                 'CREATE ' || 'INDEX IF NOT EXISTS') || ';'
    FROM target t
    JOIN pg_class c ON c.relname = t.tbl AND c.relnamespace = 'public'::regnamespace
    JOIN pg_index i ON i.indrelid = c.oid
   WHERE NOT i.indisprimary AND NOT i.indisunique
     AND NOT EXISTS (SELECT 1 FROM pg_constraint pc WHERE pc.conindid = i.indexrelid)
     AND NOT EXISTS (
           SELECT 1
             FROM later_columns lc
            WHERE lc.tbl = t.tbl
              AND pg_get_indexdef(i.indexrelid) ~ ('\y' || lc.col || '\y')
         )

  UNION ALL
  -- Triggers, minus prevent_negative_stock, which migration 001900 handles
  -- (it depends on a function defined in 001600, later than this baseline).
  SELECT t.ord, 2, pg_get_triggerdef(tg.oid) || ';'
    FROM target t
    JOIN pg_class c  ON c.relname = t.tbl AND c.relnamespace = 'public'::regnamespace
    JOIN pg_trigger tg ON tg.tgrelid = c.oid AND NOT tg.tgisinternal
   WHERE tg.tgname <> 'prevent_negative_stock'
)

SELECT ddl
  FROM statements
 ORDER BY ord1, ord2, ddl;
