import type { AssetCard, ContentDraft, GeneratedPosterAsset, Project } from "./types";

const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1440;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value: string, maxChars: number, maxLines: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const lines: string[] = [];
  let current = "";

  for (const char of normalized) {
    current += char;
    if (current.length >= maxChars) {
      lines.push(current);
      current = "";
    }
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [normalized.slice(0, maxChars)];
}

function textBlock(lines: string[], x: number, y: number, lineHeight: number, className: string) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" class="${className}">${escapeXml(line)}</text>`
    )
    .join("");
}

function safeColor(color: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

export function renderAssetCardSvg(card: AssetCard, draft: ContentDraft, project: Project) {
  const accent = safeColor(card.themeColor, safeColor(project.brandColors[0] ?? "", "#E85D75"));
  const secondary = safeColor(project.brandColors[1] ?? "", "#2E6B5F");
  const titleLines = wrapText(card.title, 12, 3);
  const subtitleLines = wrapText(card.subtitle, 18, 2);
  const draftTitleLines = wrapText(draft.selectedTitle, 18, 2);
  const bullets = card.bullets.slice(0, 4).map((bullet) => wrapText(bullet, 18, 2));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}" role="img" aria-label="${escapeXml(card.title)}">
  <defs>
    <style>
      .brand { font: 700 38px Arial, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #1F2723; letter-spacing: 0; }
      .eyebrow { font: 700 32px Arial, "PingFang SC", "Microsoft YaHei", sans-serif; fill: ${secondary}; letter-spacing: 0; }
      .title { font: 800 94px Arial, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #1F2723; letter-spacing: 0; }
      .subtitle { font: 500 42px Arial, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #5C5F58; letter-spacing: 0; }
      .bullet { font: 600 40px Arial, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #24302B; letter-spacing: 0; }
      .foot { font: 500 30px Arial, "PingFang SC", "Microsoft YaHei", sans-serif; fill: #6D6A61; letter-spacing: 0; }
    </style>
  </defs>
  <rect width="1080" height="1440" fill="#FCFAF3"/>
  <rect x="0" y="0" width="1080" height="22" fill="${accent}"/>
  <circle cx="934" cy="172" r="92" fill="${accent}" opacity="0.16"/>
  <circle cx="126" cy="1210" r="128" fill="${secondary}" opacity="0.12"/>
  <rect x="72" y="76" width="936" height="1288" rx="44" fill="#FFFFFF" stroke="#D8D2C1" stroke-width="3"/>
  <rect x="112" y="116" width="196" height="58" rx="18" fill="${accent}" opacity="0.14"/>
  <text x="136" y="156" class="eyebrow">${escapeXml(project.industry)}笔记</text>
  <text x="112" y="248" class="brand">${escapeXml(project.persona)}</text>
  ${textBlock(titleLines, 112, 410, 108, "title")}
  ${textBlock(subtitleLines, 116, 720, 58, "subtitle")}
  <rect x="112" y="848" width="856" height="330" rx="28" fill="#F8F3E7" stroke="#EFE5D3"/>
  ${bullets
    .map((lines, index) => {
      const y = 928 + index * 72;
      return `<circle cx="154" cy="${y - 12}" r="12" fill="${accent}"/>${textBlock(lines, 190, y, 46, "bullet")}`;
    })
    .join("")}
  <line x1="112" y1="1240" x2="968" y2="1240" stroke="#D8D2C1" stroke-width="3"/>
  ${textBlock(draftTitleLines, 112, 1300, 42, "foot")}
</svg>`;
}

export function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function createTemplatePosterAssets(draft: ContentDraft, project: Project): GeneratedPosterAsset[] {
  return draft.assetCards.map((card, index) => {
    const fileIndex = index + 1;
    const svg = renderAssetCardSvg(card, draft, project);
    return {
      id: `template-${card.id}`,
      cardId: card.id,
      draftId: draft.id,
      source: "template",
      url: svgToDataUrl(svg),
      alt: `${card.title} 模板海报`,
      fileName: `xhs-poster-${fileIndex}.svg`,
      mimeType: "image/svg+xml",
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT,
    };
  });
}
