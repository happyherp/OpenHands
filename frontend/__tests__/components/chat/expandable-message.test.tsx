import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "test-utils";
import { ExpandableMessage } from "#/components/features/chat/expandable-message";

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
});