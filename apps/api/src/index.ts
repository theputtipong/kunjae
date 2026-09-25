import { createDb } from "./db/client.ts";
import { createApp } from "./http/app.ts";
import { runDailyUsageCheck } from "./usecases/check-usage.ts";

const app = createApp();

export default {
  fetch: app.fetch,

  scheduled: async (_controller: ScheduledController, env: Env): Promise<void> => {
    try {
      const result = await runDailyUsageCheck(createDb(env.DB), new Date());
      if (!result.ok) console.error("[usage] ตรวจโควตาไม่สำเร็จ — อ่านฐานข้อมูลไม่ได้");
    } catch {
      console.error("[usage] ตรวจโควตาล้มเหลวด้วยข้อผิดพลาดที่ไม่คาดคิด");
    }
  },
};
