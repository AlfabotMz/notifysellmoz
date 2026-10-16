import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Palavra-passe deve ter pelo menos 6 caracteres"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Já existe uma conta associada a este email" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
      },
    });

    // Create primary store for user
    const store = await prisma.store.create({
      data: {
        userId: user.id,
        shopDomain: `loja-${user.id.substring(0, 8)}.myshopify.com`,
        shopName: `Loja de ${name}`,
        installationStatus: "PENDING",
        webhookSecret: `whsec_${Math.random().toString(36).substring(2)}${Date.now()}`,
        processingMode: "DIRECT",
      },
    });

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
      store: { id: store.id, shopDomain: store.shopDomain },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro ao registar utilizador: ${error.message}` },
      { status: 500 }
    );
  }
}
