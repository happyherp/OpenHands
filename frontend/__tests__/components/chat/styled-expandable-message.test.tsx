import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "test-utils";
import { createRoutesStub } from "react-router";
import { StyledExpandableMessage } from "#/components/features/chat/styled-expandable-message";
import OpenHands from "#/api/open-hands";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual("react-i18next");
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: {
        changeLanguage: () => new Promise(() => {}),
        language: "en",
        exists: () => true,
      },
    }),
  };
});

describe("StyledExpandableMessage", () => {
  it("should render with neutral border for non-action messages", () => {
    renderWithProviders(<StyledExpandableMessage title="Hello" content="Hello content" type="thought" />);
    const element = screen.getByText("Hello");
    const container = element.closest(
      "div.flex.gap-2.items-center.justify-start",
    );
    expect(container).toHaveClass("border-neutral-300");
    expect(screen.queryByTestId("status-icon")).not.toBeInTheDocument();
  });

  it("should render with danger border for error messages", () => {
    renderWithProviders(
      <StyledExpandableMessage title="Error occurred" content="Error details" type="error" />,
    );
    const element = screen.getByText("Error occurred");
    const container = element.closest(
      "div.flex.gap-2.items-center.justify-start",
    );
    expect(container).toHaveClass("border-danger");
    expect(screen.queryByTestId("status-icon")).not.toBeInTheDocument();
  });

  it("should render with success icon for successful action messages", () => {
    renderWithProviders(
      <StyledExpandableMessage
        title="Command executed successfully"
        content="Command details"
        type="action"
        success
      />,
    );
    const element = screen.getByText("Command executed successfully");
    const container = element.closest(
      "div.flex.gap-2.items-center.justify-start",
    );
    expect(container).toHaveClass("border-neutral-300");
    const icon = screen.getByTestId("status-icon");
    expect(icon).toHaveClass("fill-success");
  });

  it("should render with error icon for failed action messages", () => {
    renderWithProviders(
      <StyledExpandableMessage
        title="Command failed"
        content="Command details"
        type="action"
        success={false}
      />,
    );
    const element = screen.getByText("Command failed");
    const container = element.closest(
      "div.flex.gap-2.items-center.justify-start",
    );
    expect(container).toHaveClass("border-neutral-300");
    const icon = screen.getByTestId("status-icon");
    expect(icon).toHaveClass("fill-danger");
  });

  it("should render with neutral border and no icon for action messages without success prop", () => {
    renderWithProviders(
      <StyledExpandableMessage
        title="Running command"
        content="Command details"
        type="action"
      />,
    );
    const element = screen.getByText("Running command");
    const container = element.closest(
      "div.flex.gap-2.items-center.justify-start",
    );
    expect(container).toHaveClass("border-neutral-300");
    expect(screen.queryByTestId("status-icon")).not.toBeInTheDocument();
  });

  it("should render the out of credits message when the user is out of credits", async () => {
    const getConfigSpy = vi.spyOn(OpenHands, "getConfig");
    // @ts-expect-error - We only care about the APP_MODE and FEATURE_FLAGS fields
    getConfigSpy.mockResolvedValue({
      APP_MODE: "saas",
      FEATURE_FLAGS: {
        ENABLE_BILLING: true,
        HIDE_LLM_SETTINGS: false,
      },
    });
    const RouterStub = createRoutesStub([
      {
        Component: () => (
          <StyledExpandableMessage
            id="STATUS$ERROR_LLM_OUT_OF_CREDITS"
            title="Out of credits"
            content=""
            type=""
          />
        ),
        path: "/",
      },
    ]);

    renderWithProviders(<RouterStub />);
    await screen.findByTestId("out-of-credits");
  });
});