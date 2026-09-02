import { useEffect, useRef, useState } from "react";
import { FaDownload, FaTimes } from "react-icons/fa";
import { downloadVidsrcMp4 } from "../utils/vidsrcDownloader";
import type { VidsrcDownloadRequest } from "../utils/vidsrcDownloader";

type Props = { request: VidsrcDownloadRequest; onClose: () => void };
type Status = "working" | "done" | "error" | "canceled";

export default function DownloadConverter({ request, onClose }: Props) {
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState("Preparing download");
  const [progress, setProgress] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
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

  return (
    <div className="download-modal-backdrop" role="presentation">
      <section className="download-converter" role="dialog" aria-modal="true" aria-label="Download video">
        <button className="download-modal-close" onClick={close} aria-label="Close download"><FaTimes /></button>
        <div className="download-converter-icon"><FaDownload /></div>
        <h3>{request.title}</h3>
        <p className={status === "error" ? "download-status-error" : undefined}>{message}</p>
        <div className="download-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <span className="download-progress-label">{Math.round(progress * 100)}%</span>
        <button className="download-cancel" onClick={status === "working" ? close : onClose}>
          {status === "working" ? "Cancel" : "Close"}
        </button>
      </section>
    </div>
  );
}
