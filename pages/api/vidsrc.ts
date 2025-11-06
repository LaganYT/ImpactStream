import type { NextApiRequest, NextApiResponse } from "next";

type MediaType = "movie" | "tv";

const MOVIE_PROVIDERS: string[] = [
  "https://vidfast.pro/movie/",
];

const TV_PROVIDERS: string[] = [
  "https://vidfast.pro/tv/",
];

function selectProviders(type: MediaType): string[] {
  return type === "movie" ? MOVIE_PROVIDERS : TV_PROVIDERS;
}

function parseInput(req: NextApiRequest): { type: MediaType; id: string } | null {
  const { path, type, id } = req.method === "GET" ? req.query : (req.body ?? {});

  // Accept combined path like "/movie/123" or "tv/456"
  if (typeof path === "string" && path.length > 0) {
    const match = path.match(/^\/?(movie|tv)\/(\d+)/i);
    if (match) {
      return { type: match[1].toLowerCase() as MediaType, id: match[2] };
    }
  }

  // Accept separate type and id
  if (typeof type === "string" && typeof id === "string") {
    const lowered = type.toLowerCase();
    if ((lowered === "movie" || lowered === "tv") && id.trim()) {
      return { type: lowered as MediaType, id: id.trim() };
    }
  }

  return null;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = parseInput(req);
  if (!parsed) {
    return res.status(400).json({
      error:
        "Invalid input. Provide either ?path=/movie/{id} or ?type=movie&?id={id} (also supports POST JSON).",
    });
  }

  const { type, id } = parsed;
  const providers = selectProviders(type);
  const primary = providers[0] + id;

  const includeAlternatives = (() => {
    const q = (req.method === "GET" ? req.query.includeAlternatives : req.body?.includeAlternatives) as
      | string
      | undefined;
    if (!q) return false;
    return q === "1" || q === "true" || q === "yes";
  })();

  if (includeAlternatives) {
    return res.status(200).json({
      input: { type, id },
      url: primary,
      alternatives: providers.slice(1).map((base) => base + id),
    });
  }

  return res.status(200).json({ url: primary });
}


