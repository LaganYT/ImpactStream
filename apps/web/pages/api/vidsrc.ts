import type { NextApiRequest, NextApiResponse } from "next";

type MediaType = "movie" | "tv" | "anime";

type MediaRequest = {
  type: MediaType;
  id: string;
};

const VIDFAST_BASE_URL = "https://vidfast.vc";

function parseMediaRequest(req: NextApiRequest): MediaRequest | null {
  const input = req.method === "GET" ? req.query : req.body ?? {};
  const { path, type, id } = input;

  if (typeof path === "string" && path.length > 0) {
    const match = path.match(/^\/?(movie|tv|anime)\/(\d+)/i);
    if (match) {
      return { type: match[1].toLowerCase() as MediaType, id: match[2] };
    }
  }

  if (typeof type !== "string" || typeof id !== "string") return null;

  const mediaType = type.toLowerCase();
  if (mediaType !== "movie" && mediaType !== "tv" && mediaType !== "anime") return null;
  if (!id.trim()) return null;

  return { type: mediaType, id: id.trim() };
}

function buildPlaybackUrl({ type, id }: MediaRequest) {
  const pathType = type === "movie" ? "movie" : "tv";
  return `${VIDFAST_BASE_URL}/${pathType}/${id}`;
}

function shouldIncludeAlternatives(req: NextApiRequest) {
  const value = req.method === "GET" ? req.query.includeAlternatives : req.body?.includeAlternatives;
  return value === "1" || value === "true" || value === "yes";
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const mediaRequest = parseMediaRequest(req);
  if (!mediaRequest) {
    return res.status(400).json({
      error:
        "Invalid input. Provide either ?path=/movie/{id} (or /tv/{id}, /anime/{id}) or ?type=movie&id={id}. POST JSON is also supported.",
    });
  }

  const url = buildPlaybackUrl(mediaRequest);
  if (shouldIncludeAlternatives(req)) {
    return res.status(200).json({ input: mediaRequest, url, alternatives: [] });
  }

  return res.status(200).json({ url });
}
