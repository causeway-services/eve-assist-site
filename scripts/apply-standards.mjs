#!/usr/bin/env node
// Bring one static-asset property up to the web's ordinary standards, idempotently.
// Reads a property's `standards.json`, patches the <head> of the pages it names
// and writes the machine files beside them: robots.txt, sitemap.xml, llms.txt,
// .well-known/security.txt and a Workers Static Assets `_headers`. Icons and the
// social card come from brand-assets.mjs. Run it after the property's own build.
//
//   node sites/apply-standards.mjs <property-dir> [--root <public-dir>]
//
// <property-dir>/standards.json:
//   { host, name, kind: game|app|community, company: {name,url,mark},
//     description, title?, genre?, applicationCategory?, image?,
//     pages: [{ file, path, title?, description?, jsonld?: false }],
//     sitemap: ["/", ...], llms: "markdown body after the summary line",
//     csp?: "...", headersExtra?: "...", root?: "public" }
//
// It never deletes a tag the page already carries; it only fills gaps, except
// that a <title> outside 10-70 characters is replaced by the configured one.

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const GROUP = Object.freeze({ '@type': 'Organization', name: '561 Group', url: 'https://561.group/' });
export const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'];
export const COMPANIES = Object.freeze({
  causeway: { name: 'Causeway Services', url: 'https://services.561.group/', mark: 'services', eyebrow: '561 Group · Causeway Services' },
  redcup: { name: 'Red Cup Engineering', url: 'https://engineering.561.group/', mark: 'engineering', eyebrow: '561 Group · Red Cup Engineering' },
});

const esc = (text) => String(text).replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;');
const has = (html, pattern) => pattern.test(html);

export function publisher(company) {
  return { '@type': 'Organization', name: company.name, url: company.url, parentOrganization: GROUP };
}

export function jsonLd(cfg, page) {
  const url = new URL(page.path, `https://${cfg.host}/`).href;
  const company = publisher(cfg.company);
  const description = page.description ?? cfg.description;
  const home = page.path === '/';
  const graph = [{ '@id': `${company.url}#org`, ...company }];
  if (home) {
    if (cfg.kind === 'game') {
      graph.push({
        '@type': 'VideoGame', '@id': `${url}#game`, name: cfg.name, description, url,
        genre: cfg.genre ?? 'Browser game', gamePlatform: 'Web browser', applicationCategory: 'Game',
        operatingSystem: 'Any', isAccessibleForFree: true, inLanguage: cfg.language ?? 'en', publisher: company,
      });
    } else if (cfg.kind === 'app') {
      graph.push({
        '@type': cfg.appType ?? 'WebApplication', '@id': `${url}#app`, name: cfg.name, description, url,
        applicationCategory: cfg.applicationCategory ?? 'UtilitiesApplication', operatingSystem: 'Any',
        browserRequirements: 'Requires a modern web browser', isAccessibleForFree: true, publisher: company,
      });
    } else {
      graph.push({ '@type': 'Organization', '@id': `${url}#org`, name: cfg.name, description, url, logo: new URL('/logo.png', url).href, parentOrganization: GROUP, member: undefined });
    }
    graph.push({ '@type': 'WebSite', '@id': `${url}#site`, name: cfg.name, url, description, publisher: company, inLanguage: cfg.language ?? 'en' });
  } else {
    graph.push({ '@type': 'WebPage', '@id': `${url}#page`, name: page.title ?? cfg.name, description, url, isPartOf: { '@id': new URL('/', url).href + '#site' }, publisher: company });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

/** Patch one HTML document. Returns the new text. */
export function patchHtml(html, cfg, page) {
  const url = new URL(page.path, `https://${cfg.host}/`).href;
  const title = page.title ?? cfg.title ?? cfg.name;
  const description = page.description ?? cfg.description;
  const image = new URL(cfg.image ?? '/card.png', url).href;
  let out = html;
  if (!has(out, /<html[^>]+lang=/iu)) out = out.replace(/<html\b/iu, '<html lang="en"');
  const existing = out.match(/<title[^>]*>([^<]*)<\/title>/iu)?.[1]?.trim();
  if (!existing) out = out.replace(/<\/head>/iu, `<title>${esc(title)}</title></head>`);
  else if (existing.length < 10 || existing.length > 70 || page.forceTitle) out = out.replace(/<title[^>]*>[^<]*<\/title>/iu, `<title>${esc(title)}</title>`);
  if (page.canonical) {
    out = out.replace(/(<link[^>]+rel=["']canonical["'][^>]*href=["'])[^"']*(["'])/iu, `$1${url}$2`)
      .replace(/(<meta[^>]+property=["']og:url["'][^>]*content=["'])[^"']*(["'])/iu, `$1${url}$2`);
  }
  const currentDescription = out.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/iu)?.[1];
  if (currentDescription !== undefined && (currentDescription.length < 50 || currentDescription.length > 160 || page.forceDescription)) {
    out = out.replace(/(<meta[^>]+name=["']description["'][^>]*content=["'])[^"']*(["'])/iu, `$1${esc(description)}$2`);
  }
  const effectiveTitle = out.match(/<title[^>]*>([^<]*)<\/title>/iu)[1].trim();
  const add = [];
  const need = (pattern, tag) => { if (!has(out, pattern)) add.push(tag); };
  need(/<meta[^>]+name=["']viewport["']/iu, '<meta name="viewport" content="width=device-width, initial-scale=1">');
  need(/<meta[^>]+name=["']description["']/iu, `<meta name="description" content="${esc(description)}">`);
  need(/<link[^>]+rel=["']canonical["']/iu, `<link rel="canonical" href="${url}">`);
  need(/<meta[^>]+property=["']og:type["']/iu, `<meta property="og:type" content="${page.path === '/' && cfg.kind !== 'community' ? 'website' : 'website'}">`);
  need(/<meta[^>]+property=["']og:site_name["']/iu, `<meta property="og:site_name" content="${esc(cfg.name)}">`);
  need(/<meta[^>]+property=["']og:title["']/iu, `<meta property="og:title" content="${esc(effectiveTitle)}">`);
  need(/<meta[^>]+property=["']og:description["']/iu, `<meta property="og:description" content="${esc(description)}">`);
  need(/<meta[^>]+property=["']og:url["']/iu, `<meta property="og:url" content="${url}">`);
  need(/<meta[^>]+property=["']og:image["']/iu, `<meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(cfg.name)} — ${esc(cfg.company.name)}, 561 Group">`);
  // summary_large_image is the standard for a 1200x630 card, so it replaces a bare "summary".
  if (has(out, /<meta[^>]+name=["']twitter:card["'][^>]*content=["']summary["']/iu)) out = out.replace(/(<meta[^>]+name=["']twitter:card["'][^>]*content=["'])summary(["'])/iu, '$1summary_large_image$2');
  else need(/<meta[^>]+name=["']twitter:card["']/iu, '<meta name="twitter:card" content="summary_large_image">');
  need(/<meta[^>]+name=["']twitter:title["']/iu, `<meta name="twitter:title" content="${esc(effectiveTitle)}">`);
  need(/<meta[^>]+name=["']twitter:description["']/iu, `<meta name="twitter:description" content="${esc(description)}">`);
  need(/<meta[^>]+name=["']twitter:image["']/iu, `<meta name="twitter:image" content="${image}">`);
  need(/<link[^>]+rel=["'](?:shortcut )?icon["']/iu, '<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
  need(/<link[^>]+rel=["']apple-touch-icon["']/iu, '<link rel="apple-touch-icon" href="/apple-touch-icon.png">');
  if (page.jsonld !== false) {
    const types = [...out.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/giu)].map((m) => m[1]).join(' ');
    if (!/(Organization|Corporation|VideoGame|WebApplication|SoftwareApplication)/u.test(types) || !/parentOrganization/u.test(types)) {
      add.push(`<script type="application/ld+json">${jsonLd(cfg, page).replace(/</gu, '\\u003c')}</script>`);
    }
  }
  if (add.length) out = out.replace(/<\/head>/iu, `${add.join('\n')}\n</head>`);
  return out;
}

export function robotsTxt(cfg) {
  const groups = ['*', ...AI_BOTS].map((agent) => `User-agent: ${agent}\nAllow: /\n`);
  return `${groups.join('\n')}\nSitemap: https://${cfg.host}/sitemap.xml\n`;
}

export function sitemapXml(cfg, lastmod) {
  const urls = (cfg.sitemap ?? ['/']).map((entry) => {
    const [path, mod] = Array.isArray(entry) ? entry : [entry, lastmod];
    return `  <url>\n    <loc>${new URL(path, `https://${cfg.host}/`).href}</loc>\n    <lastmod>${mod ?? lastmod}</lastmod>\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function securityTxt(cfg, now = new Date()) {
  const expires = new Date(now.getTime() + 360 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/u, 'Z');
  return `Contact: mailto:cto@561.group\nExpires: ${expires}\nPreferred-Languages: en\nCanonical: https://${cfg.host}/.well-known/security.txt\n`;
}

export function llmsTxt(cfg) {
  return `# ${cfg.name}\n\n> ${cfg.description}\n\n${cfg.llms.trim()}\n\n## 561 Group\n\n- [Play](https://play.561.group/): The 561 Group's browser games.\n- [Causeway Services](https://services.561.group/): The 561 Group's public-services company: guides, games, news and an x402 market.\n- [561 Group](https://561.group/): The group and its four companies.\n`;
}

export function headersFile(cfg) {
  const csp = cfg.csp ?? ["default-src 'self'", "img-src 'self' data:", "style-src 'self' 'unsafe-inline'", "script-src 'self' https://static.cloudflareinsights.com", "connect-src 'self' https://cloudflareinsights.com", "font-src 'self' data:", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join('; ');
  const base = `/*
  Strict-Transport-Security: max-age=63072000
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Content-Security-Policy: ${csp}
/*.xml
  Access-Control-Allow-Origin: *
/*.json
  Access-Control-Allow-Origin: *
/*.txt
  Access-Control-Allow-Origin: *
`;
  return base + (cfg.headersExtra ?? '');
}

function write(root, rel, text) {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log(`wrote ${rel}`);
}

export function apply(propertyDir, rootOverride, now = new Date()) {
  const cfg = JSON.parse(readFileSync(join(propertyDir, 'standards.json'), 'utf8'));
  cfg.company = { ...COMPANIES[cfg.company] , ...(typeof cfg.company === 'object' ? cfg.company : {}) };
  const root = resolve(propertyDir, rootOverride ?? cfg.root ?? 'public');
  const lastmod = now.toISOString().slice(0, 10);
  if (cfg.static) cpSync(resolve(propertyDir, cfg.static), root, { recursive: true });
  if (cfg.sitemapFromExisting && existsSync(join(root, 'sitemap.xml'))) {
    cfg.sitemap = [...readFileSync(join(root, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/gu)].map((m) => new URL(m[1]).pathname);
  }
  for (const page of cfg.pages ?? []) {
    const pagesRoot = resolve(propertyDir, cfg.pagesRoot ?? root);
    for (const f of [page.file].flat()) {
      write(pagesRoot, f, patchHtml(readFileSync(join(pagesRoot, f), 'utf8'), cfg, page));
    }
  }
  if (!cfg.keepRobots || !existsSync(join(root, 'robots.txt'))) write(root, 'robots.txt', robotsTxt(cfg));
  write(root, 'sitemap.xml', sitemapXml(cfg, lastmod));
  write(root, 'llms.txt', llmsTxt(cfg));
  write(root, '.well-known/security.txt', securityTxt(cfg, now));
  write(root, '_headers', headersFile(cfg));
  if (!existsSync(join(root, 'card.png')) || cfg.regenerateBrand) {
    execFileSync('node', [join(HERE, 'brand-assets.mjs'), '--mark', cfg.company.mark, '--name', cfg.name,
      '--eyebrow', cfg.eyebrow ?? cfg.company.eyebrow, '--tagline', cfg.tagline, '--domain', cfg.host, '--out', root], { stdio: 'inherit' });
    rmSync(join(root, '.brand'), { recursive: true, force: true }); // drawing sources, not served
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--root');
  const root = at >= 0 ? args.splice(at, 2)[1] : undefined;
  apply(resolve(args[0] ?? '.'), root);
}
