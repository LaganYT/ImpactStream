import { useEffect, useRef, useState } from "react";
import { FaDownload, FaTimes } from "react-icons/fa";
import type { VidsrcDownloadRequest } from "../utils/vidsrcDownloader";
import {
  fetchSheguDownloadLinks,
  type SheguDownloadLink,
} from "../utils/sheguDownloader";

type Props = { request: VidsrcDownloadRequest; onClose: () => void };
type Status = "working" | "done" | "error" | "canceled";

function qualityLabel(link: SheguDownloadLink) {
  if (link.quality >= 2160) return "4K";
  if (link.quality >= 1440) return "1440p";
  if (link.quality >= 1080) return "1080p";
  if (link.quality >= 720) return "720p";
  return `${link.quality}p`;
}

export default function DownloadConverter({ request, onClose }: Props) {
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState("Finding direct downloads");
  const [downloadLinks, setDownloadLinks] = useState<SheguDownloadLink[]>([]);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("working");
    setMessage("Finding direct downloads");
    setDownloadLinks([]);

    fetchSheguDownloadLinks(
      {
        tmdbId: request.tmdbId,
        mediaType: request.mediaType,
        season: request.season,
        episode: request.episode,
      },
      controller.signal
    )
      .then((links) => {
        setDownloadLinks(links);
        setMessage(`${links.length} download option${links.length === 1 ? "" : "s"} available`);
        setStatus("done");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          setStatus("canceled");
          setMessage("Download lookup canceled");
        } else {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Could not load download options.");
        }
      });

    return () => controller.abort();
  }, [request]);

  const close = () => {
    controllerRef.current?.abort();
    onClose();
  };

  const episodeLabel =
    request.mediaType === "tv"
      ? ` · S${String(request.season || 1).padStart(2, "0")}E${String(request.episode || 1).padStart(2, "0")}`
      : "";

  return (
    <div className="download-modal-backdrop" role="presentation">
      <section
        className="download-converter"
        role="dialog"
        aria-modal="true"
        aria-label="Download video"
        style={{ width: "min(680px, 100%)" }}
      >
        <button className="download-modal-close" onClick={close} aria-label="Close download">
          <FaTimes />
        </button>
        <div className="download-converter-icon">
          <FaDownload />
        </div>
        <h3>
          {request.title}
          {episodeLabel}
        </h3>
        <p className={status === "error" ? "download-status-error" : undefined}>{message}</p>

        {downloadLinks.length > 0 ? (
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              margin: "1.25rem 0",
              maxHeight: "55vh",
              overflowY: "auto",
              textAlign: "left",
            }}
          >
            {downloadLinks.map((link, index) => (
              <a
                key={`${link.url}-${index}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "0.4rem 1rem",
                  alignItems: "center",
                  padding: "0.9rem 1rem",
                  border: "1px solid rgba(255,255,255,.12)",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,.05)",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <strong style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{link.name}</strong>
                <span style={{ fontWeight: 800 }}>{qualityLabel(link)}</span>
                <span style={{ opacity: 0.7, fontSize: "0.85rem" }}>
                  {link.source} · {link.provider}
                </span>
                <span style={{ opacity: 0.8, fontSize: "0.85rem", fontWeight: 700 }}>{link.size}</span>
              </a>
            ))}
          </div>
        ) : status === "working" ? (
          <div className="tm-loading">Loading</div>
        ) : null}

        <button className="download-cancel" onClick={status === "working" ? close : onClose}>
          {status === "working" ? "Cancel" : "Close"}
        </button>
      </section>
    </div>
  );
}
