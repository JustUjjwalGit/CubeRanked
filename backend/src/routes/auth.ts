import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthService, createGuestProfile } from "../auth/auth.service.js";
import { createRequireAuth } from "../auth/auth.middleware.js";
import { UserStore } from "../users/user-store.js";
import { successResponse } from "../utils/response.js";
import { ValidationError } from "../utils/errors.js";

const registerSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only"),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1).nullable().optional(),
});

const profileSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).optional(),
  avatar: z.string().trim().url().nullable().optional().or(z.literal("")),
  country: z.string().trim().min(2).max(56).nullable().optional().or(z.literal("")),
  bio: z.string().max(220).optional(),
  theme: z.enum(["dark", "light"]).optional(),
  favoriteMode: z.string().trim().min(1).max(40).optional(),
});

const settingsSchema = z.object({
  inspectionEnabled: z.boolean().optional(),
  animationSpeed: z.number().min(0.1).max(0.45).optional(),
  theme: z.enum(["dark", "light"]).optional(),
  hudVisible: z.boolean().optional(),
  showKeyboardCheatSheet: z.boolean().optional(),
  keybindings: z.record(z.string(), z.string()).optional(),
});

const statisticsSchema = z.object({
  gamesPlayed: z.number().int().nonnegative().optional(),
  wins: z.number().int().nonnegative().optional(),
  losses: z.number().int().nonnegative().optional(),
  botWins: z.number().int().nonnegative().optional(),
  botLosses: z.number().int().nonnegative().optional(),
  bestTimeMs: z.number().nonnegative().nullable().optional(),
  averageTimeMs: z.number().nonnegative().nullable().optional(),
  practiceHistory: z.array(z.unknown()).max(250).optional(),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  const authService = new AuthService(app.env, new UserStore(app.env));
  const requireAuth = createRequireAuth(authService);

  app.post("/auth/register", async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const session = await authService.register(input);
    return reply.status(201).send(successResponse(session));
  });

  app.post("/auth/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const session = await authService.login(input);
    return reply.status(200).send(successResponse(session));
  });

  app.post("/auth/refresh", async (request, reply) => {
    const input = refreshSchema.parse(request.body);
    const session = await authService.refresh(input.refreshToken);
    return reply.status(200).send(successResponse(session));
  });

  app.post("/auth/logout", { preHandler: requireAuth }, async (request, reply) => {
    const input = logoutSchema.parse(request.body ?? {});
    await authService.logout(input.refreshToken ?? null, request.auth?.userId);
    return reply.status(200).send(successResponse({ loggedOut: true }));
  });

  app.post("/auth/guest", async (_request, reply) => {
    return reply.status(200).send(successResponse({ user: createGuestProfile() }));
  });

  app.get("/auth/oauth/:provider", async (request, reply) => {
    const params = z.object({ provider: z.string() }).parse(request.params);
    return reply.status(200).send(successResponse(authService.getOAuthProvider(params.provider)));
  });

  app.get("/profile/me", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.auth) throw new ValidationError("Missing authenticated user");
    const profile = await authService.getProfile(request.auth.userId);
    return reply.status(200).send(successResponse(profile));
  });

  app.patch("/profile/me", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.auth) throw new ValidationError("Missing authenticated user");
    const input = profileSchema.parse(request.body);
    const profile = await authService.updateProfile(request.auth.userId, {
      ...input,
      avatar: input.avatar === "" ? null : input.avatar,
      country: input.country === "" ? null : input.country,
    });
    return reply.status(200).send(successResponse(profile));
  });

  app.get("/settings/me", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.auth) throw new ValidationError("Missing authenticated user");
    const profile = await authService.getProfile(request.auth.userId);
    return reply.status(200).send(successResponse(profile.settings));
  });

  app.put("/settings/me", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.auth) throw new ValidationError("Missing authenticated user");
    const input = settingsSchema.parse(request.body);
    const profile = await authService.updateSettings(request.auth.userId, input);
    return reply.status(200).send(successResponse(profile.settings));
  });

  app.get("/statistics/me", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.auth) throw new ValidationError("Missing authenticated user");
    const profile = await authService.getProfile(request.auth.userId);
    return reply.status(200).send(successResponse(profile.statistics));
  });

  app.put("/statistics/me", { preHandler: requireAuth }, async (request, reply) => {
    if (!request.auth) throw new ValidationError("Missing authenticated user");
    const input = statisticsSchema.parse(request.body);
    const profile = await authService.updateStatistics(request.auth.userId, input);
    return reply.status(200).send(successResponse(profile.statistics));
  });
}
