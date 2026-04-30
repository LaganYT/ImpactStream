import { ReactNode } from "react";

type MetaItem = {
  label: string;
  value: string;
};

type MediaDetailShellProps = {
  mediaLabel: string;
  title: string;
  summary: string;
  /** Iframe embed URL — used when `playerNode` is not provided. */
  embedUrl?: string;
  /** Optional custom player element that replaces the default iframe. */
  playerNode?: ReactNode;
  posterUrl: string;
  backdropUrl?: string;
  metadata: MetaItem[];
  tags?: string[];
  controls?: ReactNode;
  actions?: ReactNode;
  infoNote?: ReactNode;
};

export default function MediaDetailShell({
  mediaLabel,
  title,
  summary,
  embedUrl,
  playerNode,
  posterUrl,
  backdropUrl,
  metadata,
  tags = [],
  controls,
  actions,
  infoNote,
}: MediaDetailShellProps) {
  return (
    <div className="detail-shell">
      <section className="detail-player-panel">
        <div className="detail-panel-header">
          <div>
            <p className="detail-type">{mediaLabel}</p>
            <h1>{title}</h1>
          </div>
          {actions ? <div className="detail-actions">{actions}</div> : null}
        </div>

        <div className="movie-player detail-player-frame">
          {playerNode ?? (
            <iframe
              name="framez"
              id="framez"
              src={embedUrl}
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture"
              className="movie-iframe"
            />
          )}
        </div>

        {controls ? <div className="detail-control-grid">{controls}</div> : null}
        {infoNote ? <div className="detail-now-playing">{infoNote}</div> : null}
      </section>

      <aside className="detail-info-panel">
        <div className="detail-poster-wrap">
          <img src={posterUrl} alt={title} className="detail-poster" />
        </div>

        <div className="detail-meta-grid">
          {metadata.map((item) => (
            <div key={`${item.label}-${item.value}`} className="detail-meta-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <p className="detail-overview">{summary}</p>

        {tags.length ? (
          <div className="detail-tags">
            {tags.map((tag) => (
              <span key={tag} className="detail-tag">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {backdropUrl ? (
          <div className="detail-backdrop-wrap">
            <img src={backdropUrl} alt={`${title} backdrop`} className="detail-backdrop" />
          </div>
        ) : null}
      </aside>
    </div>
  );
}
