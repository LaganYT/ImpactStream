import { useEffect, useRef, useState } from "react";
import { FaDownload, FaTimes } from "react-icons/fa";
import {
  downloadVidsrcMp4,
  fetchMovieDownloadLinks,
  type MovieDownloadLink,
  type VidsrcDownloadRequest,
} from "../utils/vidsrcDownloader";

type Props = { request: VidsrcDownloadRequest; onClose: () => void };
type Status = "working" | "done" | "error" | "canceled";

function qualityLabel(link: MovieDownloadLink) {
  if (link.quality >= 2160) return "4K";
  if (link.quality >= 1440) return "1440p";
  if (link.quality >= 1080) return "1080p";
  if (link.quality >= 720) return "720p";
  return `${link.quality}p`;
}

export default function DownloadConverter({ request, onClose }: Props) {
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState(
    request.mediaType === "movie" ? "Finding direct downloads" : "Preparing download"
  );
  const [progress, setProgress] = useState(0);
  const [movieLinks, setMovieLinks] = useState<MovieDownloadLink[]>([]);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("working");
    setProgress(0);
    setMovieLinks([]);

    if (request.mediaType === "movie") {
      setMessage("Finding direct downloads");
      fetchMovieDownloadLinks(request.tmdbId, controller.signal)
        .then((links) => {
          setMovieLinks(links);
          setMessage(`${links.length} download option${links.length === 1 ? "" : "s"} available`);
          setProgress(1);
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
    }

    setMessage("Preparing download");
    downloadVidsrcMp4(request, {
      signal: controller.signal,
      onProgress: (update) => {
        setMessage(update.message);
        setProgress(update.progress);
      },
    })
      .then(() => setStatus("done"))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          setStatus("canceled");
          setMessage("Download canceled");
        } else {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "The download failed.");
        }
      });
    return () => controller.abort();
  }, [request]);

  const close = () => {
    controllerRef.current?.abort();
    onClose();
  };

  const isMovie = request.mediaType === "movie";

  return (
    <div className="download-modal-backdrop" role="presentation">
      <section
        className="download-converter"
        role="dialog"
        aria-modal="true"
        aria-label="Download video"
        style={isMovie ? { width: "min(680px, 100%)" } : undefined}
      >
        <button className="download-modal-close" onClick={close} aria-label="Close download">
          <FaTimes />
        </button>
        <div className="download-converter-icon">
          <FaDownload />
        </div>
        <h3>{request.title}</h3>
        <p className={status === "error" ? "download-status-error" : undefined}>{message}</p>

        {isMovie && movieLinks.length > 0 ? (
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
            {movieLinks.map((link, index) => (
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
        ) : (
          <>
            <div
              className="download-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            >
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className="download-progress-label">{Math.round(progress * 100)}%</span>
          </>
        )}

        <button className="download-cancel" onClick={status === "working" ? close : onClose}>
          {status === "working" ? "Cancel" : "Close"}
        </button>
      </section>
    </div>
  );
}
