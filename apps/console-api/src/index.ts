import { buildServer } from "./server.js";

const HOST = process.env.CONSOLE_API_HOST ?? "127.0.0.1";
const PORT = Number(process.env.CONSOLE_API_PORT ?? 4310);

const app = buildServer();

async function start() {
  try {
    await app.listen({ host: HOST, port: PORT });
    app.log.info({ host: HOST, port: PORT }, "console-api started");
  } catch (error) {
    app.log.error(error, "failed to start console-api");
    process.exit(1);
  }
}

void start();
