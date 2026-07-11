import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AchievementService } from "../achievements/achievement.service.js";
import { AchievementStore } from "../achievements/achievement-store.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { AuthService } from "../auth/auth.service.js";
import { UserStore } from "../users/user-store.js";
import { successResponse } from "../utils/response.js";
import { ValidationError } from "../utils/errors.js";

const eventSchema = z.object({
  type: z.enum([
    "solve_complete",
    "match_complete",
    "friend_added",
    "elo_changed",
    "tutorial_complete",
    "bot_complete",
    "private_match_complete",
    "win_streak",
    "spectate_match",
    "birthday_solve",
    "google_login",
  ]),
  data: z.record(z.unknown()).default({}),
});

export async function registerAchievementRoutes(app: FastifyInstance) {
  const userStore = new UserStore(app.env);
  const achievementService = new AchievementService(
    new AchievementStore(app.env),
    userStore,
  );
  const authService = new AuthService(app.env, userStore);
  const requireAuth = createRequireAuth(authService);

  app.get("/achievements", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.auth) throw new ValidationError("Missing authenticated user");

    const result = await achievementService.getAllWithProgress(request.auth.userId);
    return reply.status(200).send(successResponse(result));
  });

  app.post("/achievements/event", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.auth) throw new ValidationError("Missing authenticated user");

    const body = eventSchema.parse(request.body);
    const result = await achievementService.processEvent(
      request.auth.userId,
      { type: body.type, data: body.data },
    );

    return reply.status(200).send(successResponse(result));
  });
}
