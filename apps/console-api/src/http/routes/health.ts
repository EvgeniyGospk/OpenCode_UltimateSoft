import type { FastifyInstance } from "fastify";
import { sendData } from "../envelope.js";

export async function registerHealthRoute(app: FastifyInstance) {
  app.get("/api/v1/health", async (request, reply) => {
    return sendData(reply, request, 200, {
      status: "ok",
      service: "console-api",
      version: process.env.npm_package_version ?? "0.1.0"
    });
  });
}
