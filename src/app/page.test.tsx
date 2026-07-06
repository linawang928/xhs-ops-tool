import { render, screen } from "@testing-library/react";
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
});
