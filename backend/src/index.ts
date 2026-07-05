import "dotenv/config";
import { loadEnv } from "./config/env.js";
import { createApp } from "./app/create-app.js";

async function main() {
  const env = loadEnv();
  const app = await createApp(env);

  try {
    await app.listen({ port: env.APP_PORT, host: env.APP_HOST });
    app.log.info({ port: env.APP_PORT, host: env.APP_HOST }, "Backend started");
  } catch (error) {
    app.log.error(error, "Failed to start backend");
    process.exit(1);
  }
}

void main();
