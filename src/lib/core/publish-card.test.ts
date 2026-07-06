import { describe, expect, it } from "vitest";
import { demoDraft, demoPublishTask } from "@/lib/sample-data";
import {
  XHS_APP_PUBLISH_URL,
  createMobilePublishCardPayload,
  createMobilePublishCardUrl,
  decodeMobilePublishCardHash,
} from "./publish-card";

describe("mobile publish card", () => {
  it("encodes a publish package into a shareable hash URL", () => {
    const payload = createMobilePublishCardPayload(demoPublishTask, demoDraft);
    const url = createMobilePublishCardUrl(payload, {
      origin: "https://linawang928.github.io",
      pathname: "/xhs-ops-tool/",
    });

    expect(payload).toMatchObject({
      version: 1,
      title: demoDraft.selectedTitle,
      exportText: demoPublishTask.exportText,
      officialPublishUrl: demoPublishTask.officialPublishUrl,
      xhsAppPublishUrl: XHS_APP_PUBLISH_URL,
    });
    expect(url).toMatch(/^https:\/\/linawang928\.github\.io\/xhs-ops-tool\/#publish-card=/);

    const decoded = decodeMobilePublishCardHash(url.split("#")[1]);
    expect(decoded).toMatchObject({
      title: demoDraft.selectedTitle,
      hashtags: demoDraft.hashtags,
      exportText: demoPublishTask.exportText,
    });
  });
});
