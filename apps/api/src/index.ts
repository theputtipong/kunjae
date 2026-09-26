import * as Sentry from "@sentry/cloudflare";

import { createDb } from "./db/client.ts";
import { createApp } from "./http/app.ts";
import { sentryOptions } from "./observability.ts";
import { runDailyUsageCheck } from "./usecases/check-usage.ts";

const app = createApp();

export default Sentry.withSentry(sentryOptions, {
  fetch: app.fetch,

  scheduled: async (_controller: ScheduledController, env: Env): Promise<void> => {
    try {
      const result = await runDailyUsageCheck(createDb(env.DB), new Date());
      if (!result.ok) {
        console.error("[usage] ตรวจโควตาไม่สำเร็จ — อ่านฐานข้อมูลไม่ได้");
        Sentry.captureMessage("usage check failed: database unavailable", "error");
        return;
      }
      if (result.value.status !== "ok") {
        Sentry.captureMessage(`D1 usage ${result.value.status}`, result.value.status === "critical" ? "fatal" : "warning");
      }
    } catch (error) {
      console.error("[usage] ตรวจโควตาล้มเหลวด้วยข้อผิดพลาดที่ไม่คาดคิด");
      Sentry.captureException(error);
    }
  },
} satisfies ExportedHandler<Env>);
