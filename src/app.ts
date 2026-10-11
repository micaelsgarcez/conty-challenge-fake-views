import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { classify } from "./classify.ts";

const MAX_HOURS = 24 * 90;

class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function parseViews(body: unknown): number[] {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(422, "invalid_body", "O corpo deve ser um objeto JSON válido.");
  }
  const views = (body as Record<string, unknown>).views_per_hour;
  if (!Array.isArray(views) || views.length === 0) {
    throw new ApiError(422, "views_required", "Informe views_per_hour: a lista de views de cada hora, em ordem.");
  }
  if (views.length > MAX_HOURS) {
    throw new ApiError(422, "series_too_long", `A série pode ter no máximo ${MAX_HOURS} horas (90 dias).`);
  }
  const bad = views.findIndex((v) => !Number.isSafeInteger(v) || v < 0);
  if (bad !== -1) {
    throw new ApiError(
      422,
      "views_invalid",
      `Cada valor de views_per_hour deve ser um inteiro maior ou igual a zero. A hora ${bad + 1} veio com ${JSON.stringify(views[bad])}.`,
    );
  }
  return views as number[];
}

export function createApp() {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: err.message, code: err.code }, err.status);
    console.error(err);
    return c.json({ error: "Erro interno.", code: "internal_error" }, 500);
  });

  app.post("/classify", async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    return c.json(classify(parseViews(body)));
  });

  return app;
}
