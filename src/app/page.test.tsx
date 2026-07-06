import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("home dashboard", () => {
  it("renders the xhs operation workspaces without the scaffold content", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "小红书运营工作台" })).toBeInTheDocument();
    expect(screen.getByText("Account Positioning")).toBeInTheDocument();
    expect(screen.getByText("Topic Lab")).toBeInTheDocument();
    expect(screen.getByText("Benchmark Lab")).toBeInTheDocument();
    expect(screen.getByText("Content Studio")).toBeInTheDocument();
    expect(screen.getByText("Compliance Guard")).toBeInTheDocument();
    expect(screen.getByText("Publish Queue")).toBeInTheDocument();
    expect(screen.getByText("筛选对标内容")).toBeInTheDocument();
    expect(screen.queryByText(/To get started/)).not.toBeInTheDocument();
  });

  it("keeps benchmark subject filters usable after generating a custom account positioning", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.clear(screen.getByLabelText("账号主体区"));
    await user.type(screen.getByLabelText("账号主体区"), "家居收纳");
    await user.clear(screen.getByLabelText("目标人群"));
    await user.type(screen.getByLabelText("目标人群"), "租房党和小户型新手");
    await user.clear(screen.getByLabelText("差异化承诺"));
    await user.type(screen.getByLabelText("差异化承诺"), "把空间改造拆成低预算、可复用的清单");
    await user.clear(screen.getByLabelText("账号语气"));
    await user.type(screen.getByLabelText("账号语气"), "实用、清爽、像朋友提醒");

    await user.click(screen.getByRole("button", { name: "生成定位" }));

    expect(screen.getAllByRole("heading", { name: "家居收纳自查室" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/租房党和小户型新手/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/低预算、可复用/).length).toBeGreaterThan(0);

    const benchmarkSubjectSelect = screen.getByLabelText("主体区");
    expect(benchmarkSubjectSelect).toHaveValue("家居收纳");
    expect(screen.getByRole("option", { name: "家居收纳" })).toBeInTheDocument();
  });
});
