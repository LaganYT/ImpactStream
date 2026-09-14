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
        className="watch-frame"
        referrerPolicy="no-referrer"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
      />
    </div>
  );
}
