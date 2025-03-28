import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "test-utils";
import { createRoutesStub } from "react-router";
import { ExpandableMessage } from "#/components/features/chat/expandable-message";
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

describe("ExpandableMessage", () => {
  it("should render the title", () => {
    renderWithProviders(<ExpandableMessage title="Hello" content="Hello content" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("should not show content initially when initialExpanded is false", () => {
    renderWithProviders(
      <ExpandableMessage 
        title="Title" 
        content="Content that should be hidden" 
        initialExpanded={false} 
      />
    );
    expect(screen.queryByText("Content that should be hidden")).not.toBeInTheDocument();
  });

  it("should show content initially when initialExpanded is true", () => {
    renderWithProviders(
      <ExpandableMessage 
        title="Title" 
        content="Content that should be visible" 
        initialExpanded={true} 
      />
    );
    expect(screen.getByText("Content that should be visible")).toBeInTheDocument();
  });

  it("should toggle content visibility when clicking the button", () => {
    renderWithProviders(
      <ExpandableMessage 
        title="Title" 
        content="Toggle me" 
        initialExpanded={false} 
      />
    );
    
    // Content should be hidden initially
    expect(screen.queryByText("Toggle me")).not.toBeInTheDocument();
    
    // Click the button to show content
    const button = screen.getByRole("button");
    fireEvent.click(button);
    
    // Content should now be visible
    expect(screen.getByText("Toggle me")).toBeInTheDocument();
    
    // Click again to hide
    fireEvent.click(button);
    
    // Content should be hidden again
    expect(screen.queryByText("Toggle me")).not.toBeInTheDocument();
  });

  it("should render string content as markdown", () => {
    renderWithProviders(
      <ExpandableMessage 
        title="Title" 
        content="**Bold text**" 
        initialExpanded={true} 
      />
    );
    
    // The markdown should be rendered as HTML
    const boldElement = screen.getByText("Bold text");
    expect(boldElement.tagName).toBe("STRONG");
  });

  it("should render ReactNode content directly", () => {
    renderWithProviders(
      <ExpandableMessage 
        title="Title" 
        content={<div data-testid="custom-content">Custom Content</div>} 
        initialExpanded={true} 
      />
    );
    
    // The ReactNode should be rendered directly
    expect(screen.getByTestId("custom-content")).toBeInTheDocument();
    expect(screen.getByText("Custom Content")).toBeInTheDocument();
  });

  it("should render with neutral border for non-action messages", () => {
    renderWithProviders(<ExpandableMessage title="Hello" content="Hello content" type="thought" />);
    const element = screen.getByText("Hello");
    const container = element.closest(
      "div.flex.gap-2.items-center.justify-start",
    );
    expect(container).toHaveClass("border-neutral-300");
    expect(screen.queryByTestId("status-icon")).not.toBeInTheDocument();
  });

  it("should render with danger border for error messages", () => {
    renderWithProviders(
      <ExpandableMessage title="Error occurred" content="Error details" type="error" />,
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
      <ExpandableMessage
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
      <ExpandableMessage
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
          <ExpandableMessage
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