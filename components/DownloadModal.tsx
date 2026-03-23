import { buildDownloadUrl, SourceItem, SubtitleItem } from "../utils/videasyDownloader";

type DownloadModalProps = {
  isOpen: boolean;
  title: string;
  error: string;
  sources: SourceItem[];
  subtitles: SubtitleItem[];
  fallbackName: string;
  onClose: () => void;
};

export default function DownloadModal({
  isOpen,
  title,
  error,
  sources,
  subtitles,
  fallbackName,
  onClose,
}: DownloadModalProps) {
  if (!isOpen) return null;

  return (
    <div className="download-modal-backdrop" onClick={onClose}>
      <div className="download-modal" onClick={(e) => e.stopPropagation()}>
        <div className="download-modal-header">
          <h3>{title || "Download Sources"}</h3>
          <button
            className="download-modal-close"
            onClick={onClose}
            aria-label="Close download popup"
          >
            x
          </button>
        </div>

        {error ? (
          <div className="download-modal-error">{error}</div>
        ) : (
          <div className="download-modal-body">
            <h4>Sources</h4>
            <table className="download-modal-table">
              <thead>
                <tr>
                  <th>Quality</th>
                  <th>Open</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {sources.length ? (
                  sources.map((src, idx) => (
                    <tr key={`${src.url}-${idx}`}>
                      <td>{src.quality || "Unknown"}</td>
                      <td>
                        <a href={src.url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      </td>
                      <td>
                        <a
                          href={buildDownloadUrl(src.url, title || fallbackName)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>No sources</td>
                  </tr>
                )}
              </tbody>
            </table>

            <h4>Subtitles</h4>
            <table className="download-modal-table">
              <thead>
                <tr>
                  <th>Language</th>
                  <th>Open</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {subtitles.length ? (
                  subtitles.map((sub, idx) => (
                    <tr key={`${sub.url}-${idx}`}>
                      <td>{sub.language || sub.label || "Unknown"}</td>
                      <td>
                        <a href={sub.url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      </td>
                      <td>
                        <a href={sub.url} target="_blank" rel="noreferrer">
                          Download
                        </a>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>No subtitles</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
