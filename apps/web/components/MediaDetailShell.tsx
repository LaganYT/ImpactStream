import { useCallback, useRef } from "react";

type MediaDetailShellProps = {
  embedUrl: string;
  title?: string;
};

export default function MediaDetailShell({ embedUrl, title }: MediaDetailShellProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const installNavigationGuards = useCallback(() => {
    const frame = frameRef.current;
    const frameWindow = frame?.contentWindow;
    const frameDocument = frame?.contentDocument;
    if (!frame || !frameWindow || !frameDocument) return;

    try {
      Object.defineProperty(frameWindow, "open", {
        value: () => null,
        writable: false,
        configurable: false,
      });
    } catch {
      frameWindow.open = () => null;
    }

    const blockExternalNavigation = (event: Event) => {
      const target = event.target;
      if (!(target instanceof frameWindow.Element)) return;

      const link = target.closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href) return;

      try {
        const url = new URL(href, frameWindow.location.href);
        if (url.origin !== frameWindow.location.origin) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }

        link.removeAttribute("target");
      } catch {}
    };

    frameDocument.addEventListener("click", blockExternalNavigation, true);
    frameDocument.addEventListener("auxclick", blockExternalNavigation, true);

    frameDocument.addEventListener(
      "submit",
      (event) => {
        const form = event.target;
        if (!(form instanceof frameWindow.HTMLFormElement)) return;

        const action = form.getAttribute("action");
        if (action) {
          try {
            const url = new URL(action, frameWindow.location.href);
            if (url.origin !== frameWindow.location.origin) {
              event.preventDefault();
              event.stopImmediatePropagation();
              return;
            }
          } catch {}
        }

        form.removeAttribute("target");
      },
      true
    );
  }, []);

  return (
    <div className="watch-screen">
      <iframe
        ref={frameRef}
        src={embedUrl}
        title={title}
        className="watch-frame"
        referrerPolicy="no-referrer"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        onLoad={installNavigationGuards}
      />
    </div>
  );
}
