import type { ContentDraft, Project, PublishTask, PublishTaskStatus } from "./types";

export const XHS_CREATOR_PUBLISH_URL = "https://creator.xiaohongshu.com/publish/publish";

function createExportText(draft: ContentDraft) {
  const tags = draft.hashtags.map((tag) => `#${tag}`).join(" ");
  return `${draft.selectedTitle}\n\n${draft.body}\n\n${tags}`;
}

export function prepareManualPublishPackage(
  draft: ContentDraft,
  project: Project,
  scheduledAt: string
): PublishTask {
  const timestamp = "2026-07-06T10:00:00.000Z";

  return {
    id: `publish-${draft.id}`,
    projectId: project.id,
    draftId: draft.id,
    scheduledAt,
    status: "ready",
    publisherMode: "manual",
    officialPublishUrl: XHS_CREATOR_PUBLISH_URL,
    checklist: [
      "人工复核敏感词和导流表达",
      "确认封面首屏标题无夸大承诺",
      "确认图片顺序和正文结构一致",
      "用手机或官方创作服务平台完成最终发布",
      "发布后记录笔记链接和初始互动数据",
    ],
    exportText: createExportText(draft),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function transitionPublishTask(task: PublishTask, nextStatus: PublishTaskStatus): PublishTask {
  if (task.status === "ready" && nextStatus === "published") {
    throw new Error("Publish task must be queued before it can be marked published");
  }

  const allowed: Record<PublishTaskStatus, PublishTaskStatus[]> = {
    ready: ["queued", "blocked"],
    queued: ["published", "blocked"],
    published: ["published"],
    blocked: ["ready"],
  };

  if (!allowed[task.status].includes(nextStatus)) {
    throw new Error(`Cannot move publish task from ${task.status} to ${nextStatus}`);
  }

  return {
    ...task,
    status: nextStatus,
    updatedAt: "2026-07-06T10:05:00.000Z",
  };
}
