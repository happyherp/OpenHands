import React from "react";
import { useTranslation } from "react-i18next";
import { Progress } from "@heroui/react";

interface RuntimePullProgressProps {
  progress: number;
  message: string;
}

export function RuntimePullProgress({
  progress,
  message,
}: RuntimePullProgressProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 min-w-[300px]">
      <div className="text-sm text-white">{message}</div>
      <Progress
        value={progress}
        className="w-full"
        color="primary"
        size="sm"
        showValueLabel
        formatOptions={{
          style: "percent",
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }}
      />
      <div className="text-xs text-gray-400">
        {t("RUNTIME$PULL_FIRST_TIME_INFO")}
      </div>
    </div>
  );
}
