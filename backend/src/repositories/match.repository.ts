import type { PrismaClient } from "@prisma/client";

export class MatchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string) {
    return this.prisma.match.findUnique({ where: { id } });
  }
}
