import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RuntimePullProgress } from "#/components/shared/runtime-pull-progress";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "RUNTIME$PULL_FIRST_TIME_INFO": "First-time startup: downloading runtime image",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock @heroui/react
vi.mock("@heroui/react", () => ({
  Progress: ({ value, label, size, color, showValueLabel, className }: any) => (
    <div
      data-testid="progress"
      data-value={value}
      data-label={label}
      data-size={size}
      data-color={color}
      data-show-value-label={showValueLabel}
      className={className}
    >
      <div data-testid="progress-label">{label}</div>
      <div data-testid="progress-value">{value}%</div>
    </div>
  ),
}));

describe("RuntimePullProgress", () => {
  it("renders with correct progress value", () => {
    render(<RuntimePullProgress progress={45.5} message="Downloading..." />);
    
    const progressElement = screen.getByTestId("progress");
    expect(progressElement).toHaveAttribute("data-value", "45.5");
  });

  it("displays the correct message", () => {
    const message = "Downloading sandbox runtime (75.2%)";
    render(<RuntimePullProgress progress={75.2} message={message} />);
    
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("shows first-time startup info", () => {
    render(<RuntimePullProgress progress={25} message="Downloading..." />);
    
    expect(screen.getByText("First-time startup: downloading runtime image")).toBeInTheDocument();
  });

  it("applies correct styling classes", () => {
    render(<RuntimePullProgress progress={60} message="Downloading..." />);
    
    const progressElement = screen.getByTestId("progress");
    expect(progressElement).toHaveAttribute("data-size", "sm");
    expect(progressElement).toHaveAttribute("data-color", "primary");
    expect(progressElement).toHaveAttribute("data-show-value-label", "true");
    expect(progressElement).toHaveClass("w-full");
  });

  it("handles zero progress", () => {
    render(<RuntimePullProgress progress={0} message="Starting download..." />);
    
    const progressElement = screen.getByTestId("progress");
    expect(progressElement).toHaveAttribute("data-value", "0");
    expect(screen.getByText("Starting download...")).toBeInTheDocument();
  });

  it("handles complete progress", () => {
    render(<RuntimePullProgress progress={100} message="Download complete!" />);
    
    const progressElement = screen.getByTestId("progress");
    expect(progressElement).toHaveAttribute("data-value", "100");
    expect(screen.getByText("Download complete!")).toBeInTheDocument();
  });

  it("handles decimal progress values", () => {
    render(<RuntimePullProgress progress={33.33} message="Downloading..." />);
    
    const progressElement = screen.getByTestId("progress");
    expect(progressElement).toHaveAttribute("data-value", "33.33");
  });

  it("renders with long message text", () => {
    const longMessage = "Downloading sandbox runtime image with very long layer name and detailed progress information (87.5%)";
    render(<RuntimePullProgress progress={87.5} message={longMessage} />);
    
    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });

  it("maintains consistent structure", () => {
    render(<RuntimePullProgress progress={50} message="Test message" />);
    
    // Check that all expected elements are present
    expect(screen.getByTestId("progress")).toBeInTheDocument();
    expect(screen.getByTestId("progress-label")).toBeInTheDocument();
    expect(screen.getByTestId("progress-value")).toBeInTheDocument();
    expect(screen.getByText("First-time startup: downloading runtime image")).toBeInTheDocument();
  });

  it("handles edge case progress values", () => {
    // Test negative progress (shouldn't happen but test robustness)
    const { rerender } = render(<RuntimePullProgress progress={-5} message="Error case" />);
    let progressElement = screen.getByTestId("progress");
    expect(progressElement).toHaveAttribute("data-value", "-5");

    // Test progress over 100 (shouldn't happen but test robustness)
    rerender(<RuntimePullProgress progress={150} message="Over 100%" />);
    progressElement = screen.getByTestId("progress");
    expect(progressElement).toHaveAttribute("data-value", "150");
  });

  it("updates when props change", () => {
    const { rerender } = render(<RuntimePullProgress progress={25} message="Starting..." />);
    
    expect(screen.getByTestId("progress")).toHaveAttribute("data-value", "25");
    expect(screen.getByText("Starting...")).toBeInTheDocument();

    rerender(<RuntimePullProgress progress={75} message="Almost done..." />);
    
    expect(screen.getByTestId("progress")).toHaveAttribute("data-value", "75");
    expect(screen.getByText("Almost done...")).toBeInTheDocument();
  });
});