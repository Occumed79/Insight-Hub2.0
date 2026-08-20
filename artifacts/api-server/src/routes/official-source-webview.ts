import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const SOURCE_HOSTS: Record<string, string[]> = {
  bls: ["bls.gov"],
  osha: ["osha.gov"],
  datagov: ["data.gov"],
  onet: ["onetonline.org"],
};

const SOURCE_START_URLS: Record<string, string> = {
  bls: "https://www.bls.gov/iif/nonfatal-injuries-and-illnesses-tables/soii-summary-historical.htm",
  osha: "https://www.osha.gov/data",
  datagov: "https://catalog.data.gov/?q=occupational+safety+and+health",
  onet: "https://www.onetonline.org/find/quick",
};

function sourceId(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 24) : "";
}

function allowedHost(source: string, hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  const roots = SOURCE_HOSTS[source] ?? [];
  return roots.some((root) => normalized === root || normalized.endsWith(`.${root}`));
}

function allowedUrl(source: string, raw: string): URL | null {
  if (!SOURCE_HOSTS[source] || raw.length > 5000) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!allowedHost(source, url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function proxiedPath(source: string, url: URL): string {
  return `/api/official-source-webview?source=${encodeURIComponent(source)}&url=${encodeURIComponent(url.toString())}`;
}

async function fetchOfficial(source: string, initialUrl: URL): Promise<{ response: globalThis.Response; finalUrl: URL }> {
  let current = initialUrl;

  for (let redirect = 0; redirect <= 5; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "Mozilla/5.0 (compatible; Occu-Med-Insight-Hub/2.0; official-source-webview)",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { response, finalUrl: current };
        const next = allowedUrl(source, new URL(location, current).toString());
        if (!next) throw new Error("Official source redirected outside its approved government domain.");
        current = next;
        continue;
      }

      return { response, finalUrl: current };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Too many redirects from official source.");
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rewriteAnchors(source: string, finalUrl: URL, html: string): string {
  return html.replace(/(<a\b[^>]*?\bhref\s*=\s*)(["'])([^"']*)(\2)/gi, (match, prefix: string, quote: string, raw: string) => {
    const trimmed = String(raw || "").trim();
    if (!trimmed || trimmed.startsWith("#") || /^(?:mailto:|tel:|javascript:|data:)/i.test(trimmed)) return match;
    try {
      const target = allowedUrl(source, new URL(trimmed, finalUrl).toString());
      if (!target) return match;
      return `${prefix}${quote}${escapeAttribute(proxiedPath(source, target))}${quote}`;
    } catch {
      return match;
    }
  });
}

function transformHtml(source: string, finalUrl: URL, html: string): string {
  const sourceJson = JSON.stringify(source).replace(/</g, "\\u003c");
  const rootsJson = JSON.stringify(SOURCE_HOSTS[source] ?? []).replace(/</g, "\\u003c");
  const baseTag = `<base href="${escapeAttribute(finalUrl.toString())}">`;

  let output = html
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?Content-Security-Policy["']?[^>]*>/gi, "")
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?X-Frame-Options["']?[^>]*>/gi, "");

  output = rewriteAnchors(source, finalUrl, output);

  const bridge = `<script>(function(){
    const source=${sourceJson};
    const roots=${rootsJson};
    const endpoint='/api/official-source-webview';
    const allowed=function(url){
      const host=url.hostname.toLowerCase().replace(/\\.$/,'');
      return url.protocol==='https:' && roots.some(function(root){return host===root || host.endsWith('.'+root);});
    };
    const proxied=function(url){return endpoint+'?source='+encodeURIComponent(source)+'&url='+encodeURIComponent(url.toString());};
    const targetFor=function(value){
      try { const url=new URL(String(value||''),document.baseURI); return allowed(url)?url:null; }
      catch(_){ return null; }
    };
    const rewriteAnchor=function(anchor){
      const raw=anchor.getAttribute('href');
      if(!raw || raw.charAt(0)==='#' || /^(mailto:|tel:|javascript:|data:)/i.test(raw)) return;
      const target=targetFor(raw);
      if(target) anchor.setAttribute('href',proxied(target));
    };
    document.querySelectorAll('a[href]').forEach(rewriteAnchor);
    const observer=new MutationObserver(function(records){
      records.forEach(function(record){
        record.addedNodes.forEach(function(node){
          if(!(node instanceof Element)) return;
          if(node.matches && node.matches('a[href]')) rewriteAnchor(node);
          node.querySelectorAll && node.querySelectorAll('a[href]').forEach(rewriteAnchor);
        });
      });
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    document.addEventListener('click',function(event){
      if(event.defaultPrevented || (typeof event.button==='number' && event.button!==0) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor=event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if(!anchor) return;
      try {
        const href=anchor.getAttribute('href') || '';
        if(href.startsWith(endpoint)) return;
        const url=new URL(href,document.baseURI);
        if(!/^https?:$/.test(url.protocol)) return;
        if(allowed(url)) {
          event.preventDefault();
          window.location.assign(proxied(url));
        }
      } catch (_) {}
    },true);
    document.addEventListener('submit',function(event){
      const form=event.target;
      if(!(form instanceof HTMLFormElement)) return;
      const method=(form.method || 'get').toLowerCase();
      if(method!=='get') return;
      try {
        const url=new URL(form.action || document.baseURI,document.baseURI);
        if(!allowed(url)) return;
        const params=new URLSearchParams(new FormData(form));
        params.forEach(function(value,key){url.searchParams.append(key,value);});
        event.preventDefault();
        window.location.assign(proxied(url));
      } catch (_) {}
    },true);
    const originalOpen=window.open.bind(window);
    window.open=function(url,target,features){
      const official=targetFor(url);
      return originalOpen(official?proxied(official):url,target,features);
    };
    ['pushState','replaceState'].forEach(function(method){
      const original=history[method].bind(history);
      history[method]=function(state,title,url){
        if(url){
          const official=targetFor(url);
          if(official){ window.location.assign(proxied(official)); return; }
        }
        return original(state,title,url);
      };
    });
  })();</script>`;

  if (/<head\b[^>]*>/i.test(output)) output = output.replace(/<head\b([^>]*)>/i, `<head$1>${baseTag}`);
  else output = `${baseTag}${output}`;

  if (/<\/body>/i.test(output)) output = output.replace(/<\/body>/i, `${bridge}</body>`);
  else output += bridge;

  return output;
}

router.get("/official-source-webview", async (req: Request, res: Response) => {
  const source = sourceId(req.query.source);
  if (!SOURCE_HOSTS[source]) {
    return res.status(400).type("text/plain").send("Unknown official source.");
  }

  const requested = typeof req.query.url === "string" && req.query.url.trim()
    ? req.query.url.trim()
    : SOURCE_START_URLS[source];
  const target = allowedUrl(source, requested);
  if (!target) {
    return res.status(400).type("text/plain").send("Requested URL is outside the approved official-source domain.");
  }

  try {
    const { response, finalUrl } = await fetchOfficial(source, target);
    if (!response.ok) {
      return res.status(response.status).type("text/plain").send(`Official source returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Cache-Control", "private, max-age=60");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");

    if (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")) {
      const html = await response.text();
      const transformed = transformHtml(source, finalUrl, html);
      return res.status(200).type("html").send(transformed);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    res.status(200);
    res.setHeader("Content-Type", contentType);
    const disposition = response.headers.get("content-disposition");
    if (disposition) res.setHeader("Content-Disposition", disposition);
    return res.send(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Official source request failed.";
    return res.status(502).type("text/plain").send(message.slice(0, 500));
  }
});

export default router;
