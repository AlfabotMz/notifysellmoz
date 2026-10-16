import { Worker } from "bullmq";
import { getRedisConnection, getRedisUrl } from "./connection";
import { processOrderNotifications, QUEUE_NAME } from "./notifications";

let worker: Worker | null = null;

export function startNotificationWorker(): Worker | null {
  if (worker) return worker;

  if (!getRedisUrl()) {
    console.error(
      "[notifysell] REDIS_URL em falta. O worker de notificações Shopify/WhatsApp não arrancou."
    );
    return null;
  }

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      await processOrderNotifications(job.data);
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[notifysell] Job ${job?.id} falhou:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[notifysell] Erro no worker Redis:", err.message);
  });

  console.info("[notifysell] Worker BullMQ de notificações iniciado.");
  return worker;
}
