import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { healthRoutes } from "./routes/health";

export function createApp() {
  return new Elysia()
    .use(
      cors({
        origin: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Origin", "Content-Type", "Accept", "Authorization"],
        maxAge: 86400
      })
    )
    .use(healthRoutes);
}
