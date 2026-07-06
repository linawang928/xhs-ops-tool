import { analyzeBenchmarkNote } from "@/lib/core/benchmark";
import { generateDraftFromTopic } from "@/lib/core/content";
import { generateAccountPositioning } from "@/lib/core/account";
import { prepareManualPublishPackage } from "@/lib/core/publish";
import { generateTopicCandidates } from "@/lib/core/topic";
import type { BenchmarkCandidate, Project, RawBenchmarkNote } from "@/lib/core/types";

export const demoProject: Project = {
  id: "project-1",
  name: "轻量护肤账号",
  persona: "像朋友一样给新手做护肤决策辅助",
  industry: "护肤",
  tone: "真诚、克制、有细节",
  audience: "25-35 岁的成分护肤新手",
  forbiddenWords: ["全网最低", "根治", "躺赚"],
  brandColors: ["#E85D75", "#2E6B5F", "#F6C85F"],
};

export const demoRawBenchmark: RawBenchmarkNote = {
  id: "bench-1",
  projectId: demoProject.id,
  sourceUrl: "https://www.xiaohongshu.com/explore/mock",
  title: "敏感肌修护别乱买，先看这 4 个成分",
  author: "成分笔记",
  body: "脸颊反复泛红的时候，我最怕被一句话种草。\n1. 先看屏障脂质\n2. 再看舒缓成分\n3. 最后看使用频率\n你们最近还踩过哪些坑？评论区互相避雷。\n#敏感肌 #屏障修护 #护肤避坑",
  metrics: { likes: 3200, saves: 2100, comments: 188 },
  importedAt: "2026-07-06T10:00:00.000Z",
};

export const demoAccountPositioning = generateAccountPositioning({
  projectId: demoProject.id,
  subjectArea: demoProject.industry,
  audience: demoProject.audience,
  differentiator: "把复杂成分翻译成能执行的日常判断",
  tone: demoProject.tone,
});

export const demoBenchmarkCandidates: BenchmarkCandidate[] = [
  {
    id: "bench-storage-1",
    projectId: demoProject.id,
    title: "租房收纳别急着买柜子，先看这 5 个死角",
    author: "小户型整理局",
    subjectArea: "家居收纳",
    contentFormat: "避坑清单",
    audiencePain: "租房党空间小、预算有限，不知道先改哪里",
    tags: ["租房收纳", "小户型", "收纳避坑"],
    metrics: { likes: 5200, saves: 3600, comments: 240 },
  },
  {
    id: "bench-storage-2",
    projectId: demoProject.id,
    title: "小户型入口区整理流程，每天出门少找 10 分钟",
    author: "动线改造笔记",
    subjectArea: "家居收纳",
    contentFormat: "流程模板",
    audiencePain: "钥匙、包和快递总堆在门口，早上容易乱",
    tags: ["入口区收纳", "租房改造", "整理流程"],
    metrics: { likes: 3900, saves: 2600, comments: 156 },
  },
  {
    id: "bench-skincare-1",
    projectId: demoProject.id,
    title: "敏感肌修护别乱买，先看这 4 个成分",
    author: "成分笔记",
    subjectArea: "护肤",
    contentFormat: "避坑清单",
    audiencePain: "敏感肌新手不知道怎么判断屏障状态",
    tags: ["敏感肌", "屏障修护", "护肤避坑"],
    metrics: { likes: 3200, saves: 2100, comments: 188 },
  },
  {
    id: "bench-skincare-2",
    projectId: demoProject.id,
    title: "油敏肌早八护肤流程，3 分钟出门",
    author: "早八研究所",
    subjectArea: "护肤",
    contentFormat: "流程模板",
    audiencePain: "通勤前时间少但又怕泛红",
    tags: ["油敏肌", "早八", "护肤流程"],
    metrics: { likes: 2400, saves: 1600, comments: 132 },
  },
  {
    id: "bench-skincare-3",
    projectId: demoProject.id,
    title: "同价位修护精华怎么选：3 个维度对比",
    author: "理性种草员",
    subjectArea: "护肤",
    contentFormat: "测评对比",
    audiencePain: "预算有限时不知道怎么做取舍",
    tags: ["修护精华", "护肤测评", "成分党"],
    metrics: { likes: 1800, saves: 1380, comments: 97 },
  },
  {
    id: "bench-beauty-1",
    projectId: demoProject.id,
    title: "黄黑皮通勤妆 5 分钟提气色",
    author: "通勤妆研究",
    subjectArea: "美妆",
    contentFormat: "流程模板",
    audiencePain: "早上时间少但想显精神",
    tags: ["通勤妆", "黄黑皮", "快速出门"],
    metrics: { likes: 4100, saves: 1400, comments: 120 },
  },
  {
    id: "bench-local-1",
    projectId: demoProject.id,
    title: "周末上海咖啡路线，三家都适合拍照",
    author: "城市散步",
    subjectArea: "本地生活",
    contentFormat: "路线合集",
    audiencePain: "周末不知道去哪玩",
    tags: ["上海探店", "咖啡", "周末"],
    metrics: { likes: 4600, saves: 900, comments: 90 },
  },
];

export const demoBenchmark = analyzeBenchmarkNote(demoRawBenchmark);

export const demoTopics = generateTopicCandidates("敏感肌修护", demoProject);

export const demoDraft = generateDraftFromTopic(demoTopics[0], demoProject, [demoBenchmark]);

export const demoPublishTask = prepareManualPublishPackage(
  demoDraft,
  demoProject,
  "2026-07-07T12:30:00.000Z"
);
