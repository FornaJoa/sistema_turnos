import "./load-env.ts";
import { sql } from "drizzle-orm";
import { db } from "./index";

async function cleanupDuplicateSchedules() {
  const before = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM schedules
  `);

  const result = await db.execute(sql`
    DELETE FROM schedules a
    USING schedules b
    WHERE a.id > b.id
      AND a.staff_id = b.staff_id
      AND a.day_of_week = b.day_of_week
      AND a.start_time = b.start_time
      AND a.end_time = b.end_time
  `);

  const after = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM schedules
  `);

  const removed =
    Number(before[0]?.total ?? 0) - Number(after[0]?.total ?? 0);

  console.log(`Schedules before: ${before[0]?.total ?? 0}`);
  console.log(`Schedules after:  ${after[0]?.total ?? 0}`);
  console.log(`Removed ${removed} duplicate row(s).`);
  console.log(result.count ? `Delete command count: ${result.count}` : "Cleanup done.");
}

cleanupDuplicateSchedules()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
