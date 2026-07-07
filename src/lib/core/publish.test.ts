import { describe, expect, it } from "vitest";
import {
  createPublishPackageMarkdown,
  prepareManualPublishPackage,
  transitionPublishTask,
} from "./publish";
import type { ContentDraft, GeneratedPosterAsset, Project, PublishTask } from "./types";

const project: Project = {
  id: "project-1",
  name: "轻量护肤账号",
  persona: "像朋友一样给新手做护肤决策辅助",
  industry: "护肤",
  tone: "真诚、克制、有细节",
  audience: "25-35 岁的成分护肤新手",
  forbiddenWords: ["全网最低", "根治"],
  brandColors: ["#E85D75", "#2E6B5F", "#F6C85F"],
};

const draft: ContentDraft = {
  id: "draft-1",
  projectId: project.id,
  topicId: "topic-1",
  titleOptions: ["敏感肌屏障修护避坑清单", "敏感肌别乱买", "新手修护路线"],
  selectedTitle: "敏感肌屏障修护避坑清单",
  body: "先确认屏障状态，再选择舒缓成分，最后记录使用频率。",
  hashtags: ["敏感肌", "屏障修护", "护肤避坑"],
  assetCards: [
    {
      id: "card-1",
      draftId: "draft-1",
      role: "cover",
      title: "敏感肌修护",
      subtitle: "先避开这 4 个坑",
      bullets: ["先看屏障", "再看舒缓"],
      themeColor: "#E85D75",
    },
  ],
  compliance: {
    riskLevel: "low",
    issues: [],
    sanitizedText: "先确认屏障状态，再选择舒缓成分，最后记录使用频率。",
  },
  createdAt: "2026-07-06T10:00:00.000Z",
};

describe("publish queue", () => {
  it("prepares a manual publishing package with guard checklist and official entry", () => {
    const task = prepareManualPublishPackage(
      draft,
      project,
      "2026-07-07T12:30:00.000Z"
    );

    expect(task.status).toBe("ready");
    expect(task.publisherMode).toBe("manual");
    expect(task.officialPublishUrl).toBe("https://creator.xiaohongshu.com/publish/publish");
    expect(task.checklist).toContain("人工复核敏感词和导流表达");
    expect(task.exportText).toContain(draft.selectedTitle);
    expect(task.exportText).toContain("#敏感肌");
  });

  it("includes generated poster assets in the publish package manifest", () => {
    const posterAssets: GeneratedPosterAsset[] = [
      {
        id: "poster-card-1",
        cardId: "card-1",
        draftId: "draft-1",
        source: "template",
        url: "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E",
        alt: "敏感肌修护封面",
        fileName: "xhs-poster-1.svg",
        mimeType: "image/svg+xml",
        width: 1080,
        height: 1440,
      },
    ];

    const task = prepareManualPublishPackage(
      draft,
      project,
      "2026-07-07T12:30:00.000Z",
      posterAssets
    );

    expect(task.assetManifest).toEqual([
      {
        cardId: "card-1",
        fileName: "xhs-poster-1.svg",
        mimeType: "image/svg+xml",
        source: "template",
        description: "敏感肌修护封面",
      },
    ]);
    expect(task.checklist).toContain("确认已下载或分享所有海报素材");
  });

  it("renders a Markdown publish package with copy, checklist, cards, and assets", () => {
    const task = prepareManualPublishPackage(
      draft,
      project,
      "2026-07-07T12:30:00.000Z",
      [
        {
          id: "poster-card-1",
          cardId: "card-1",
          draftId: "draft-1",
          source: "template",
          url: "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E",
          alt: "敏感肌修护封面",
          fileName: "xhs-poster-1.svg",
          mimeType: "image/svg+xml",
          width: 1080,
          height: 1440,
        },
      ]
    );

    const markdown = createPublishPackageMarkdown(task, draft, project);

    expect(markdown).toContain("# 敏感肌屏障修护避坑清单");
    expect(markdown).toContain("账号：轻量护肤账号");
    expect(markdown).toContain("先确认屏障状态");
    expect(markdown).toContain("#敏感肌 #屏障修护 #护肤避坑");
    expect(markdown).toContain("- [ ] 人工复核敏感词和导流表达");
    expect(markdown).toContain("xhs-poster-1.svg");
    expect(markdown).toContain("敏感肌修护");
    expect(markdown).toContain("https://creator.xiaohongshu.com/publish/publish");
  });

  it("only allows publish tasks to move through the manual workflow order", () => {
    const task: PublishTask = prepareManualPublishPackage(
      draft,
      project,
      "2026-07-07T12:30:00.000Z"
    );

    const queued = transitionPublishTask(task, "queued");
    expect(queued.status).toBe("queued");

    const published = transitionPublishTask(queued, "published");
    expect(published.status).toBe("published");

    expect(() => transitionPublishTask(task, "published")).toThrow(
      "Publish task must be queued before it can be marked published"
    );
  });
});
