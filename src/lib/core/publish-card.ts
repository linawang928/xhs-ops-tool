import type { ContentDraft, GeneratedPosterAsset, PosterAssetSource, PublishTask } from "./types";

export const XHS_APP_PUBLISH_URL = "xhsdiscover://post";
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
  return encodeBase64Url(JSON.stringify(payload));
}

export function decodeMobilePublishCardHash(hash: string): MobilePublishCardPayload | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const encoded = raw.startsWith("publish-card=") ? raw.slice("publish-card=".length) : raw;
  if (!encoded) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as Partial<MobilePublishCardPayload>;
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
        typeof parsed.officialPublishUrl === "string"
          ? parsed.officialPublishUrl
          : "https://creator.xiaohongshu.com/publish/publish",
      xhsAppPublishUrl:
        typeof parsed.xhsAppPublishUrl === "string" ? parsed.xhsAppPublishUrl : XHS_APP_PUBLISH_URL,
      checklist: Array.isArray(parsed.checklist)
        ? parsed.checklist.filter((item): item is string => typeof item === "string")
        : [],
      assetManifest: Array.isArray(parsed.assetManifest)
        ? (parsed.assetManifest as PublishTask["assetManifest"])
        : [],
      assetPreviews: Array.isArray(parsed.assetPreviews)
        ? parsed.assetPreviews
            .filter(isMobileAssetPreview)
            .slice(0, MAX_INLINE_ASSET_COUNT)
        : [],
    };
  } catch {
    return null;
  }
}

export function createMobilePublishCardUrl(payload: MobilePublishCardPayload, parts: UrlParts) {
  const pathname = normalizePathname(parts.pathname);
  return `${parts.origin}${pathname}#publish-card=${encodeMobilePublishCardPayload(payload)}`;
}
