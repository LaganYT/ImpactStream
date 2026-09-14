import { useCallback, useRef } from "react";

const MEDIA_PROXY_PATH = "/api/vidfast-media-proxy";
const VIDFAST_MEDIA_HOST_SUFFIXES = [".peakstorm.top"];

type MediaDetailShellProps = {
  embedUrl: string;
  title?: string;
};

function shouldProxyMedia(url: URL) {
  const hostname = url.hostname.toLowerCase();
  return VIDFAST_MEDIA_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix)
  );
}

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

    const proxifyMediaUrl = (value: string | URL) => {
      try {
        const url = new URL(String(value), frameWindow.location.href);
        if (!shouldProxyMedia(url)) return value;
        return `${MEDIA_PROXY_PATH}?url=${encodeURIComponent(url.toString())}`;
      } catch {
        return value;
      }
    };

    const nativeFetch = frameWindow.fetch.bind(frameWindow);
    frameWindow.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (input instanceof frameWindow.Request) {
        const proxiedUrl = proxifyMediaUrl(input.url);
        if (proxiedUrl !== input.url) {
          input = new frameWindow.Request(String(proxiedUrl), input);
        }
      } else if (typeof input === "string" || input instanceof frameWindow.URL) {
        input = proxifyMediaUrl(input) as string | URL;
      }

      return nativeFetch(input, init);
    };

    const nativeXhrOpen = frameWindow.XMLHttpRequest.prototype.open;
    frameWindow.XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      const proxiedUrl = proxifyMediaUrl(url);
      return nativeXhrOpen.call(
        this,
        method,
        String(proxiedUrl),
        async ?? true,
        username ?? null,
        password ?? null
      );
    };

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
