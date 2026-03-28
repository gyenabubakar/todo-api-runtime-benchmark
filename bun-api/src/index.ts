import { createApp } from "./app";
import { config } from "./config";

const app = createApp();

app.listen({
  hostname: "0.0.0.0",
  port: config.port
});

console.log(`Bun API listening on port ${config.port} (${config.environment})`);
