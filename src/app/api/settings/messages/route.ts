import { NextResponse } from "next/server";
import { requireAuth, getOrCreatePrimaryStore } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TEMPLATES, validateTemplate, renderTemplate, getSampleVariables } from "@/lib/templates/renderer";
import { z } from "zod";

const templatesSchema = z.object({
  storeId: z.string().optional(),
  templates: z.record(z.string()),
});

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const storeIdParam = url.searchParams.get("storeId");

    let store;
    if (storeIdParam) {
      store = await prisma.store.findFirst({
        where: { id: storeIdParam, userId: user.id },
        include: { messageTemplates: true },
      });
    } else {
      store = await getOrCreatePrimaryStore(user.id);
    }

    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const saved = await prisma.messageTemplate.findMany({
      where: { storeId: store.id },
    });
    const templates: Record<string, string> = { ...DEFAULT_TEMPLATES };

    for (const item of saved) {
      templates[item.messageType] = item.content;
    }

    // Generate previews with sample Mozambican data
    const sampleVars = getSampleVariables();
    const previews: Record<string, string> = {};
    for (const [key, content] of Object.entries(templates)) {
      previews[key] = renderTemplate(content, sampleVars);
    }

    return NextResponse.json({
      storeId: store.id,
      templates,
      previews,
      sampleVariables: sampleVars,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = templatesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { storeId: storeIdParam, templates } = parsed.data;

    let store;
    if (storeIdParam) {
      store = await prisma.store.findFirst({
        where: { id: storeIdParam, userId: user.id },
      });
    } else {
      store = await getOrCreatePrimaryStore(user.id);
    }

    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    // Validate variables in every template
    for (const [type, content] of Object.entries(templates)) {
      const check = validateTemplate(content);
      if (!check.valid) {
        return NextResponse.json(
          {
            error: `O modelo '${type}' contém variáveis inválidas: ${check.invalidVars.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Upsert templates
    for (const [type, content] of Object.entries(templates)) {
      await prisma.messageTemplate.upsert({
        where: {
          storeId_messageType: {
            storeId: store.id,
            messageType: type,
          },
        },
        update: {
          content,
          enabled: true,
        },
        create: {
          storeId: store.id,
          messageType: type,
          content,
          enabled: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Modelos de mensagem guardados com sucesso",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro ao guardar modelos: ${error.message}` },
      { status: error.name === "UnauthorizedError" ? 401 : 500 }
    );
  }
}
