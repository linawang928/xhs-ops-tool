import QRCode from "qrcode";
import type { ContentDraft, GeneratedPosterAsset, PosterAssetSource, PublishTask } from "./types";

export const XHS_APP_PUBLISH_URL = "xhsdiscover://post";
const DEFAULT_OFFICIAL_PUBLISH_URL = "https://creator.xiaohongshu.com/publish/publish";
const MAX_INLINE_ASSET_URL_LENGTH = 120_000;
const MAX_INLINE_ASSET_COUNT = 6;

export interface MobilePublishCardAssetPreview {
  cardId: string;
  fileName: string;
  mimeType: string;
  source: PosterAssetSource;
  description: string;
  url: string;
}

export interface MobilePublishCardPayload {
  version: 1;
  title: string;
  body: string;
  hashtags: string[];
  exportText: string;
  scheduledAt: string;
  officialPublishUrl: string;
  xhsAppPublishUrl: string;
  checklist: string[];
  assetManifest: PublishTask["assetManifest"];
  assetPreviews: MobilePublishCardAssetPreview[];
}

interface UrlParts {
  origin: string;
  pathname: string;
}

type PublishAssetManifestItem = PublishTask["assetManifest"][number];

interface CompactPublishAssetManifestItem {
  i: string;
  f: string;
  mt: string;
  s: PosterAssetSource;
  d: string;
}

interface CompactMobileAssetPreview {
  i: string;
  f: string;
  mt: string;
  s: PosterAssetSource;
  d: string;
  u: string;
}

interface CompactMobilePublishCardPayload {
  v: 1;
  t: string;
  b: string;
  h: string[];
  e?: string;
  sa: string;
  o?: string;
  x?: string;
  c: string[];
  m: CompactPublishAssetManifestItem[];
  p: CompactMobileAssetPreview[];
}

function encodeBase64Url(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64url").toString("utf8");
  }

  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizePathname(pathname: string) {
  if (!pathname) return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function createExportText(title: string, body: string, hashtags: string[]) {
  const tags = hashtags.map((tag) => `#${tag}`).join(" ");
  return `${title}\n\n${body}\n\n${tags}`;
}

function toStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function createAssetPreviews(assets: GeneratedPosterAsset[]): MobilePublishCardAssetPreview[] {
  return assets
    .filter((asset) => asset.url.startsWith("data:") && asset.url.length <= MAX_INLINE_ASSET_URL_LENGTH)
    .slice(0, MAX_INLINE_ASSET_COUNT)
    .map((asset) => ({
      cardId: asset.cardId,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      source: asset.source,
      description: asset.alt,
      url: asset.url,
    }));
}

function isPosterAssetSource(value: string): value is PosterAssetSource {
  return value === "template" || value === "openai";
}

function isMobileAssetPreview(value: unknown): value is MobilePublishCardAssetPreview {
  const asset = value as Partial<MobilePublishCardAssetPreview>;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof asset.cardId === "string" &&
    typeof asset.fileName === "string" &&
    typeof asset.mimeType === "string" &&
    typeof asset.source === "string" &&
    isPosterAssetSource(asset.source) &&
    typeof asset.description === "string" &&
    typeof asset.url === "string" &&
    asset.url.startsWith("data:") &&
    asset.url.length <= MAX_INLINE_ASSET_URL_LENGTH
  );
}

export function createMobilePublishCardPayload(
  task: PublishTask,
  draft: ContentDraft,
  assets: GeneratedPosterAsset[] = []
): MobilePublishCardPayload {
  return {
    version: 1,
    title: draft.selectedTitle,
    body: draft.body,
    hashtags: draft.hashtags,
    exportText: task.exportText,
    scheduledAt: task.scheduledAt,
    officialPublishUrl: task.officialPublishUrl,
    xhsAppPublishUrl: XHS_APP_PUBLISH_URL,
    checklist: task.checklist,
    assetManifest: task.assetManifest,
    assetPreviews: createAssetPreviews(assets),
  };
}

export function encodeMobilePublishCardPayload(payload: MobilePublishCardPayload) {
  const defaultExportText = createExportText(payload.title, payload.body, payload.hashtags);
  const compactPayload: CompactMobilePublishCardPayload = {
    v: 1,
    t: payload.title,
    b: payload.body,
    h: payload.hashtags,
    ...(payload.exportText === defaultExportText ? {} : { e: payload.exportText }),
    sa: payload.scheduledAt,
    ...(payload.officialPublishUrl === DEFAULT_OFFICIAL_PUBLISH_URL
      ? {}
      : { o: payload.officialPublishUrl }),
    ...(payload.xhsAppPublishUrl === XHS_APP_PUBLISH_URL ? {} : { x: payload.xhsAppPublishUrl }),
    c: payload.checklist,
    m: payload.assetManifest.map((asset) => ({
      i: asset.cardId,
      f: asset.fileName,
      mt: asset.mimeType,
      s: asset.source,
      d: asset.description,
    })),
    p: payload.assetPreviews.map((asset) => ({
      i: asset.cardId,
      f: asset.fileName,
      mt: asset.mimeType,
      s: asset.source,
      d: asset.description,
      u: asset.url,
    })),
  };

  return encodeBase64Url(JSON.stringify(compactPayload));
}

function parseFullMobilePublishCardPayload(parsed: Partial<MobilePublishCardPayload>) {
  if (
    parsed.version !== 1 ||
    typeof parsed.title !== "string" ||
    typeof parsed.body !== "string" ||
    typeof parsed.exportText !== "string" ||
    !Array.isArray(parsed.hashtags)
  ) {
    return null;
  }

  return {
    version: 1,
    title: parsed.title,
    body: parsed.body,
    hashtags: parsed.hashtags.filter((tag): tag is string => typeof tag === "string"),
    exportText: parsed.exportText,
    scheduledAt: typeof parsed.scheduledAt === "string" ? parsed.scheduledAt : "",
    officialPublishUrl:
      typeof parsed.officialPublishUrl === "string" ? parsed.officialPublishUrl : DEFAULT_OFFICIAL_PUBLISH_URL,
    xhsAppPublishUrl:
      typeof parsed.xhsAppPublishUrl === "string" ? parsed.xhsAppPublishUrl : XHS_APP_PUBLISH_URL,
    checklist: toStringList(parsed.checklist),
    assetManifest: Array.isArray(parsed.assetManifest)
      ? (parsed.assetManifest as PublishTask["assetManifest"])
      : [],
    assetPreviews: Array.isArray(parsed.assetPreviews)
      ? parsed.assetPreviews.filter(isMobileAssetPreview).slice(0, MAX_INLINE_ASSET_COUNT)
      : [],
  } satisfies MobilePublishCardPayload;
}

function isCompactPublishAssetManifestItem(value: unknown): value is CompactPublishAssetManifestItem {
  const asset = value as Partial<CompactPublishAssetManifestItem>;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof asset.i === "string" &&
    typeof asset.f === "string" &&
    typeof asset.mt === "string" &&
    typeof asset.s === "string" &&
    isPosterAssetSource(asset.s) &&
    typeof asset.d === "string"
  );
}

function isCompactMobileAssetPreview(value: unknown): value is CompactMobileAssetPreview {
  const asset = value as Partial<CompactMobileAssetPreview>;
  return (
    isCompactPublishAssetManifestItem(value) &&
    typeof asset.u === "string" &&
    asset.u.startsWith("data:") &&
    asset.u.length <= MAX_INLINE_ASSET_URL_LENGTH
  );
}

function expandCompactManifestItem(asset: CompactPublishAssetManifestItem): PublishAssetManifestItem {
  return {
    cardId: asset.i,
    fileName: asset.f,
    mimeType: asset.mt,
    source: asset.s,
    description: asset.d,
  };
}

function expandCompactAssetPreview(asset: CompactMobileAssetPreview): MobilePublishCardAssetPreview {
  return {
    ...expandCompactManifestItem(asset),
    url: asset.u,
  };
}

function parseCompactMobilePublishCardPayload(parsed: Partial<CompactMobilePublishCardPayload>) {
  if (
    parsed.v !== 1 ||
    typeof parsed.t !== "string" ||
    typeof parsed.b !== "string" ||
    !Array.isArray(parsed.h)
  ) {
    return null;
  }

  const hashtags = toStringList(parsed.h);
  return {
    version: 1,
    title: parsed.t,
    body: parsed.b,
    hashtags,
    exportText: typeof parsed.e === "string" ? parsed.e : createExportText(parsed.t, parsed.b, hashtags),
    scheduledAt: typeof parsed.sa === "string" ? parsed.sa : "",
    officialPublishUrl: typeof parsed.o === "string" ? parsed.o : DEFAULT_OFFICIAL_PUBLISH_URL,
    xhsAppPublishUrl: typeof parsed.x === "string" ? parsed.x : XHS_APP_PUBLISH_URL,
    checklist: toStringList(parsed.c),
    assetManifest: Array.isArray(parsed.m)
      ? parsed.m.filter(isCompactPublishAssetManifestItem).map(expandCompactManifestItem)
      : [],
    assetPreviews: Array.isArray(parsed.p)
      ? parsed.p.filter(isCompactMobileAssetPreview).slice(0, MAX_INLINE_ASSET_COUNT).map(expandCompactAssetPreview)
      : [],
  } satisfies MobilePublishCardPayload;
}

export function decodeMobilePublishCardHash(hash: string): MobilePublishCardPayload | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const encoded = raw.startsWith("publish-card=") ? raw.slice("publish-card=".length) : raw;
  if (!encoded) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as
      | Partial<MobilePublishCardPayload>
      | Partial<CompactMobilePublishCardPayload>;
    return (
      parseCompactMobilePublishCardPayload(parsed as Partial<CompactMobilePublishCardPayload>) ??
      parseFullMobilePublishCardPayload(parsed as Partial<MobilePublishCardPayload>)
    );
  } catch {
    return null;
  }
}

export function createMobilePublishCardUrl(payload: MobilePublishCardPayload, parts: UrlParts) {
  const pathname = normalizePathname(parts.pathname);
  return `${parts.origin}${pathname}#publish-card=${encodeMobilePublishCardPayload(payload)}`;
}

export async function createMobilePublishCardQrSvg(url: string) {
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "L",
    margin: 2,
    width: 256,
    color: {
      dark: "#1F2723",
      light: "#FFFFFF",
    },
  });

  return svg.replace("<svg ", '<svg role="img" aria-label="手机发布卡二维码" ');
}
