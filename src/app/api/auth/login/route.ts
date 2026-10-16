import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Palavra-passe é obrigatória"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        stores: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Credenciais inválidas. Verifique o seu email e palavra-passe." },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Credenciais inválidas. Verifique o seu email e palavra-passe." },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    await setSessionCookie(token);

    const primaryStore = user.stores[0] || null;

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
      store: primaryStore ? { id: primaryStore.id, shopDomain: primaryStore.shopDomain } : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro ao iniciar sessão: ${error.message}` },
      { status: 500 }
    );
  }
}
