import { getSession } from "./session";
import { prisma } from "../db/prisma";

export class UnauthorizedError extends Error {
  constructor(message = "Não autorizado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Acesso proibido a esta loja") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Validates that current request is from an authenticated user
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new UnauthorizedError("Sessão expirada ou não autenticado");
  }
  return session.user;
}

/**
 * Validates that the store belongs strictly to the authenticated user
 * Enforces multi-tenant data isolation.
 */
export async function requireStoreAccess(storeId: string, userId?: string) {
  let targetUserId = userId;
  if (!targetUserId) {
    const user = await requireAuth();
    targetUserId = user.id;
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      whatsAppConnection: true,
      recipients: true,
    },
  });

  if (!store) {
    throw new ForbiddenError("Loja não encontrada");
  }

  if (store.userId !== targetUserId) {
    throw new ForbiddenError("Tentativa de acesso não autorizada aos dados de outra loja");
  }

  return store;
}

/**
 * Gets or creates the primary store for the authenticated user
 */
export async function getOrCreatePrimaryStore(userId: string) {
  let store = await prisma.store.findFirst({
    where: { userId },
    include: {
      whatsAppConnection: true,
      recipients: true,
    },
  });

  if (!store) {
    // Generate an initial store configuration
    store = await prisma.store.create({
      data: {
        userId,
        shopDomain: `loja-${userId.substring(0, 8)}.myshopify.com`,
        shopName: "Minha Loja",
        installationStatus: "PENDING",
        webhookSecret: `whsec_${Math.random().toString(36).substring(2)}${Date.now()}`,
        processingMode: "DIRECT",
      },
      include: {
        whatsAppConnection: true,
        recipients: true,
      },
    });
  }

  return store;
}
