import type { NextApiRequest, NextApiResponse } from "next";

type MediaType = "movie" | "tv";

const MOVIE_PROVIDERS: string[] = [
  "https://vidsrc.me/embed/movie/",
  "https://vidsrc.in/embed/movie/",
  "https://vidsrc.net/embed/movie/",
  "https://vidsrc.pm/embed/movie/",
  "https://vidsrc.xyz/embed/movie/",
  "https://vidsrc.cc/v3/embed/movie/",
  "https://embed.su/embed/movie/",
  "https://vidlink.pro/movie/",
  "https://vidsrc.icu/embed/movie/",
  "https://player.autoembed.cc/embed/movie/",
  "https://vidsrc.to/embed/movie/",
];

const TV_PROVIDERS: string[] = [
  "https://vidsrc.me/embed/tv/",
  "https://vidsrc.in/embed/tv/",
  "https://vidsrc.net/embed/tv/",
  "https://vidsrc.pm/embed/tv/",
  "https://vidsrc.xyz/embed/tv/",
  "https://vidsrc.cc/v3/embed/tv/",
  "https://embed.su/embed/tv/",
  "https://vidsrc.icu/embed/tv/",
  "https://player.autoembed.cc/embed/tv/",
  "https://vidsrc.to/embed/tv/",
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


