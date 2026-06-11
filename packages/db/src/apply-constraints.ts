import "./load-env.ts";
import { sql } from "drizzle-orm";
import { db } from "./index";

async function applyConstraints() {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS btree_gist`);

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlap'
      ) THEN
        ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
        EXCLUDE USING gist (
          staff_id WITH =,
          tstzrange(start_at, end_at, '[)') WITH &&
        ) WHERE (status IN ('pending', 'confirmed'));
      END IF;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'appointment_holds_no_overlap'
      ) THEN
        ALTER TABLE appointment_holds ADD CONSTRAINT appointment_holds_no_overlap
        EXCLUDE USING gist (
          staff_id WITH =,
          tstzrange(start_at, end_at, '[)') WITH &&
        );
      END IF;
    END $$;
  `);

  console.log("Overlap constraints applied (appointments + holds).");

  const demoFix = await db.execute(sql`
    UPDATE users SET is_platform_admin = false WHERE email = 'owner@demo.com'
  `);
  console.log(`Demo owner platform admin flag cleared (${demoFix.count ?? 0} row(s)).`);
}

applyConstraints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
