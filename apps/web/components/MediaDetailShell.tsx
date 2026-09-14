type MediaDetailShellProps = {
  embedUrl: string;
  title?: string;
};

export default function MediaDetailShell({ embedUrl, title }: MediaDetailShellProps) {
  return (
    <div className="watch-screen">
      <iframe
        src={embedUrl}
        title={title}
        allowFullScreen
        className="watch-frame"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      />
    </div>
  );
}
