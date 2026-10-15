import { useEffect } from "react";
import { FaTimes } from "react-icons/fa";

// Full-screen YouTube trailer, closed with Escape, the X, or a click outside.
export default function TrailerDialog({
  videoKey,
  title,
  onClose,
}: {
  videoKey: string;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="trailer-overlay" onClick={onClose}>
      <div
        className="trailer-frame"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} trailer`}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="icon-button trailer-close" onClick={onClose} aria-label="Close trailer">
          <FaTimes />
        </button>
        <iframe
          src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0&playsinline=1`}
          title={`${title} trailer`}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
