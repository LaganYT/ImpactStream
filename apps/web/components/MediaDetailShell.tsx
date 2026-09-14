type MediaDetailShellProps = {
  embedUrl: string;
  title?: string;
};

export default function MediaDetailShell({ embedUrl, title }: MediaDetailShellProps) {
  return (
    <div className="watch-screen">
      <iframe
        name="framez"
        id="framez"
        src={embedUrl}
        title={title}
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
        className="watch-frame"
      />
    </div>
  );
}
