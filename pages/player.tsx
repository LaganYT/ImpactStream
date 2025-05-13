import { useRouter } from "next/router";

export default function Player() {
  const router = useRouter();
  const { url } = router.query;

  if (!url) return <div className="loading">Loading...</div>;

  return (
    <div className="player-container">
      <iframe
        src={decodeURIComponent(url as string)}
        allowFullScreen
        className="player-iframe"
      ></iframe>
    </div>
  );
}
