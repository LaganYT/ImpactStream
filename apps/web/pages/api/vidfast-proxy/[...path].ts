import type { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "node:stream";

const VIDFAST_ORIGIN = "https://vidfast.vc";
const PROXY_PREFIX = "/api/vidfast-proxy";
const COOKIE_PREFIX = "vf_";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

function buildUpstreamUrl(req: NextApiRequest) {
  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const upstreamUrl = new URL(`/${pathParts.map(String).join("/")}`, VIDFAST_ORIGIN);

  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path") continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) upstreamUrl.searchParams.append(key, String(item));
    }
  }

  return upstreamUrl;
}

function proxyUrl(value: string) {
  try {
    const url = new URL(value, VIDFAST_ORIGIN);
    if (url.origin !== VIDFAST_ORIGIN) return value;
    return `${PROXY_PREFIX}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}

function getUpstreamCookieHeader(req: NextApiRequest) {
  return (req.headers.cookie || "")
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(COOKIE_PREFIX))
    .map((cookie) => cookie.slice(COOKIE_PREFIX.length))
    .join("; ");
}

function rewriteSetCookie(cookie: string) {
  const parts = cookie.split(";").map((part) => part.trim());
  const [nameValue, ...attributes] = parts;
  const equalsIndex = nameValue.indexOf("=");
  if (equalsIndex <= 0) return null;

  const name = nameValue.slice(0, equalsIndex);
  const value = nameValue.slice(equalsIndex + 1);
  const rewrittenAttributes = attributes.filter(
    (attribute) => !/^domain=/i.test(attribute) && !/^path=/i.test(attribute)
  );

  return [
    `${COOKIE_PREFIX}${name}=${value}`,
    `Path=${PROXY_PREFIX}`,
    ...rewrittenAttributes,
  ].join("; ");
}

function copySetCookies(upstream: Response, res: NextApiResponse) {
  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookies = getSetCookie ? getSetCookie.call(upstream.headers) : [];
  const rewritten = cookies.map(rewriteSetCookie).filter((cookie): cookie is string => Boolean(cookie));
  if (rewritten.length) res.setHeader("Set-Cookie", rewritten);
}

function rewriteHtml(html: string) {
  const guardScript = `<script>(function(){
    var upstream=${JSON.stringify(VIDFAST_ORIGIN)};
    var prefix=${JSON.stringify(PROXY_PREFIX)};
    function proxify(value){
      try {
        var url=new URL(String(value),upstream);
        return url.origin===upstream?prefix+url.pathname+url.search+url.hash:value;
      }catch(_){return value;}
    }

    try{
      Object.defineProperty(window,'open',{value:function(){return null;},writable:false,configurable:false});
    }catch(_){
      window.open=function(){return null;};
    }

    var nativeFetch=window.fetch;
    if(nativeFetch){
      window.fetch=function(input,init){
        if(typeof input==='string'||input instanceof URL){
          return nativeFetch.call(this,proxify(input),init);
        }
        if(input instanceof Request){
          var next=proxify(input.url);
          if(next!==input.url) input=new Request(next,input);
        }
        return nativeFetch.call(this,input,init);
      };
    }

    var nativeOpen=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(method,url){
      arguments[1]=proxify(url);
      return nativeOpen.apply(this,arguments);
    };

    function blockExternalNavigation(event){
      var element=event.target instanceof Element?event.target.closest('a'):null;
      if(!element)return;
      var href=element.getAttribute('href');
      if(!href)return;
      try{
        var url=new URL(href,upstream);
        if(url.origin!==upstream){
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        element.href=proxify(url.href);
        element.removeAttribute('target');
      }catch(_){}
    }

    document.addEventListener('click',blockExternalNavigation,true);
    document.addEventListener('auxclick',blockExternalNavigation,true);

    document.addEventListener('submit',function(event){
      var form=event.target;
      if(!(form instanceof HTMLFormElement))return;
      var action=form.getAttribute('action');
      if(action){
        try{
          var url=new URL(action,upstream);
          if(url.origin!==upstream){
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
          }
          form.action=proxify(url.href);
        }catch(_){}
      }
      form.removeAttribute('target');
    },true);
  })();</script>`;

  const rewriteAttribute = (
    _match: string,
    name: string,
    quote: string,
    value: string
  ) => {
    if (value.startsWith("//") || value.startsWith("data:") || value.startsWith("blob:")) {
      return `${name}=${quote}${value}${quote}`;
    }

    if (value.startsWith("/") || value.startsWith(VIDFAST_ORIGIN)) {
      return `${name}=${quote}${proxyUrl(value)}${quote}`;
    }

    return `${name}=${quote}${value}${quote}`;
  };

  let rewritten = html.replace(
    /\b(src|href|poster|action)=(['"])([^'"]*)\2/gi,
    rewriteAttribute
  );

  const baseTag = `<base href="${PROXY_PREFIX}/">`;
  if (/<head[^>]*>/i.test(rewritten)) {
    rewritten = rewritten.replace(/<head([^>]*)>/i, `<head$1>${baseTag}${guardScript}`);
  } else {
    rewritten = `${baseTag}${guardScript}${rewritten}`;
  }

  return rewritten;
}

function rewriteCss(css: string) {
  return css.replace(
    /url\((['"]?)\/(?!\/|api\/vidfast-proxy\/)([^)'"\s]+)\1\)/gi,
    `url($1${PROXY_PREFIX}/$2$1)`
  );
}

function rewriteJavaScript(source: string) {
  return source
    .replace(/(["'`])\/_next\//g, `$1${PROXY_PREFIX}/_next/`)
    .replace(/https:\/\/vidfast\.vc\/_next\//g, `${PROXY_PREFIX}/_next/`);
}

function copyResponseHeaders(upstream: Response, res: NextApiResponse) {
  const passthrough = [
    "accept-ranges",
    "cache-control",
    "content-disposition",
    "content-range",
    "etag",
    "last-modified",
  ];

  for (const name of passthrough) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

async function readRequestBody(req: NextApiRequest) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, Accept");
    return res.status(204).end();
  }

  const upstreamUrl = buildUpstreamUrl(req);
  if (upstreamUrl.origin !== VIDFAST_ORIGIN) {
    return res.status(400).json({ message: "Unsupported upstream host" });
  }

  const method = req.method || "GET";
  const headers = new Headers();
  const forwardedHeaders = ["accept", "accept-language", "content-type", "range", "user-agent"];
  for (const name of forwardedHeaders) {
    const value = req.headers[name];
    if (typeof value === "string") headers.set(name, value);
  }

  const upstreamCookies = getUpstreamCookieHeader(req);
  if (upstreamCookies) headers.set("cookie", upstreamCookies);
  headers.set("referer", `${VIDFAST_ORIGIN}/`);
  headers.set("origin", VIDFAST_ORIGIN);

  try {
    const body = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(req);
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      redirect: "manual",
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (!location) return res.status(502).json({ message: "Invalid upstream redirect" });

      const redirectUrl = new URL(location, upstreamUrl);
      if (redirectUrl.origin !== VIDFAST_ORIGIN) {
        return res.status(502).json({ message: "Blocked external upstream redirect" });
      }

      res.setHeader("Location", proxyUrl(redirectUrl.href));
      return res.status(upstream.status).end();
    }

    copySetCookies(upstream, res);
    copyResponseHeaders(upstream, res);
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";

    if (contentType.includes("text/html")) {
      const html = rewriteHtml(await upstream.text());
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.status(upstream.status).send(html);
    }

    if (contentType.includes("text/css")) {
      const css = rewriteCss(await upstream.text());
      res.setHeader("Content-Type", contentType);
      return res.status(upstream.status).send(css);
    }

    if (
      contentType.includes("javascript") ||
      contentType.includes("ecmascript") ||
      contentType.includes("application/x-javascript")
    ) {
      const javascript = rewriteJavaScript(await upstream.text());
      res.setHeader("Content-Type", contentType);
      return res.status(upstream.status).send(javascript);
    }

    res.setHeader("Content-Type", contentType);
    if (!upstream.body) return res.status(upstream.status).end();

    res.status(upstream.status);
    Readable.fromWeb(upstream.body as any).pipe(res);
  } catch (error) {
    console.error("Vidfast proxy request failed:", error);
    return res.status(502).json({ message: "Vidfast proxy request failed" });
  }
}
