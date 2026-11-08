"use client";

import type { ReactNode } from "react";
import { useTrackNavigation } from "@/shared/hooks/use-safe-back";
import { OutboxSync } from "@/features/transactions/components/OutboxSync";
import { AppShellV2 } from "@/features/shell/v2/AppShellV2";

export interface ShellProps {
  children: ReactNode;
  modal: ReactNode;
}

export function Shell({ children, modal }: ShellProps) {
  useTrackNavigation();
  return (
    <>
      <OutboxSync />
      <AppShellV2 modal={modal}>{children}</AppShellV2>
    </>
  );
}
