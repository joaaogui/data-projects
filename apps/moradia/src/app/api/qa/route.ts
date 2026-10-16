import type {
  PropertyQuestionItem,
  PropertyQuestionSnapshot,
} from "@/types/moradia";
import { NextResponse } from "next/server";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const dynamic = "force-dynamic";

const LOCAL_QA_FILE = join(process.cwd(), "src/data/property-qa.json");
const TMP_QA_FILE = join(tmpdir(), "moradia-property-qa.json");
const CURSOR_QUEUE_FILE =
  "/Users/joao.guilherme/.cursor/Empty/.card-questions-queue.jsonl";

function parseQaRaw(raw: unknown): PropertyQuestionItem[] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is PropertyQuestionItem =>
        Boolean(item && typeof item === "object" && "id" in item && "propertyKey" in item),
    );
  }
  if (
    raw &&
    typeof raw === "object" &&
    "items" in raw &&
    Array.isArray((raw as { items: unknown }).items)
  ) {
    return (raw as { items: unknown[] }).items.filter(
      (item): item is PropertyQuestionItem =>
        Boolean(item && typeof item === "object" && "id" in item && "propertyKey" in item),
    );
  }
  return [];
}

function loadQaItemsFromDisk(): PropertyQuestionItem[] {
  // Prefer LOCAL_QA_FILE if it exists so direct edits by the Cursor agent to src/data/property-qa.json are always picked up immediately!
  if (existsSync(/*turbopackIgnore: true*/ LOCAL_QA_FILE)) {
    try {
      const raw = JSON.parse(
        readFileSync(/*turbopackIgnore: true*/ LOCAL_QA_FILE, "utf8"),
      ) as unknown;
      return parseQaRaw(raw);
    } catch {
      // Fallback to TMP_QA_FILE
    }
  }
  if (existsSync(/*turbopackIgnore: true*/ TMP_QA_FILE)) {
    try {
      const raw = JSON.parse(
        readFileSync(/*turbopackIgnore: true*/ TMP_QA_FILE, "utf8"),
      ) as unknown;
      return parseQaRaw(raw);
    } catch {
      return [];
    }
  }
  return [];
}

function saveQaItemsToDisk(items: PropertyQuestionItem[]): void {
  const serialized = `${JSON.stringify({ items }, null, 2)}\n`;
  try {
    mkdirSync(dirname(LOCAL_QA_FILE), { recursive: true });
    writeFileSync(LOCAL_QA_FILE, serialized, "utf8");
  } catch {
    // Fallback to /tmp in read-only serverless environments
  }
  try {
    writeFileSync(TMP_QA_FILE, serialized, "utf8");
  } catch {
    // Ignore /tmp write errors
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyKey = searchParams.get("propertyKey");
  const status = searchParams.get("status");

  let items = loadQaItemsFromDisk();
  if (propertyKey) {
    items = items.filter((item) => item.propertyKey === propertyKey);
  }
  if (status === "pending" || status === "answered") {
    items = items.filter((item) => item.status === status);
  }

  return NextResponse.json(
    { ok: true, items },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "ask" | "answer" | "delete";
      id?: string;
      propertyKey?: string;
      question?: string;
      answer?: string;
      propertySnapshot?: PropertyQuestionSnapshot;
    };

    const action = body.action ?? "ask";
    const items = loadQaItemsFromDisk();

    if (action === "answer") {
      if (!body.id || typeof body.answer !== "string" || !body.answer.trim()) {
        return NextResponse.json(
          { ok: false, error: "ID da pergunta e resposta são obrigatórios." },
          { status: 400 },
        );
      }

      const idx = items.findIndex((i) => i.id === body.id);
      if (idx === -1) {
        return NextResponse.json(
          { ok: false, error: "Pergunta não encontrada." },
          { status: 404 },
        );
      }

      const updatedItem: PropertyQuestionItem = {
        ...items[idx]!,
        status: "answered",
        answer: body.answer.trim(),
        answeredAt: new Date().toISOString(),
      };
      items[idx] = updatedItem;
      saveQaItemsToDisk(items);

      return NextResponse.json({ ok: true, item: updatedItem, items });
    }

    if (action === "delete") {
      if (!body.id) {
        return NextResponse.json(
          { ok: false, error: "ID da pergunta é obrigatório." },
          { status: 400 },
        );
      }
      const nextItems = items.filter((i) => i.id !== body.id);
      saveQaItemsToDisk(nextItems);
      return NextResponse.json({ ok: true, items: nextItems });
    }

    // Default action === "ask"
    const propertyKey = (body.propertyKey ?? "").trim();
    const question = (body.question ?? "").trim();
    if (!propertyKey || !question) {
      return NextResponse.json(
        { ok: false, error: "Imóvel e pergunta são obrigatórios." },
        { status: 400 },
      );
    }

    const defaultSnapshot: PropertyQuestionSnapshot = {
      title: propertyKey,
      neighborhood: "",
      cityCode: "",
      street: "",
      streetNumber: null,
      condominiumName: null,
      totalMonthly: 0,
      rent: 0,
      condoFee: 0,
      iptu: 0,
      areaM2: 0,
      bedrooms: 0,
      bathrooms: 0,
      parkingSpaces: 0,
      floor: null,
      floorLabel: null,
      furnished: null,
      modernityScore: 0,
      finalScore: 0,
      overallRank: null,
      url: "",
      shortJustification: "",
      description: null,
    };

    const newItem: PropertyQuestionItem = {
      id: `qa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      propertyKey,
      question,
      status: "pending",
      answer: null,
      createdAt: new Date().toISOString(),
      answeredAt: null,
      propertySnapshot: {
        ...defaultSnapshot,
        ...(body.propertySnapshot ?? {}),
      },
    };

    const nextItems = [...items, newItem];
    saveQaItemsToDisk(nextItems);

    try {
      mkdirSync(dirname(CURSOR_QUEUE_FILE), { recursive: true });
      appendFileSync(
        CURSOR_QUEUE_FILE,
        `${JSON.stringify({ event: "MORADIA_QUESTION_RECEIVED", item: newItem })}\n`,
        "utf8",
      );
    } catch {
      // Ignore queue append errors when running outside local workspace
    }

    return NextResponse.json({ ok: true, item: newItem, items: nextItems });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Erro ao processar pergunta sobre o imóvel.",
      },
      { status: 500 },
    );
  }
}
