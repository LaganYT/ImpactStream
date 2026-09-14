type MediaDetailShellProps = {
  embedUrl: string;
  title?: string;
};

const PLAYER_SANDBOX = [
  "allow-scripts",
  "allow-same-origin",
  "allow-forms",
  "allow-presentation",
].join(" ");

export default function MediaDetailShell({ embedUrl, title }: MediaDetailShellProps) {
  return (
    <div className="watch-screen">
      <iframe
        src={embedUrl}
        title={title}
        className="watch-frame"
        sandbox={PLAYER_SANDBOX}
        referrerPolicy="no-referrer"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
      />
    </div>
  );
}
