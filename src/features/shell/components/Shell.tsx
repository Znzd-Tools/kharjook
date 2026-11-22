"use client";

import type { ReactNode } from "react";
import { useTrackNavigation } from "@/shared/hooks/use-safe-back";
import { OutboxSync } from "@/features/transactions/components/OutboxSync";
import { AppShellV2 } from "@/features/shell/v2/AppShellV2";
import { AssetPlacesProvider } from "@/features/asset-places/components/AssetPlacesProvider";
import { PlaceReconciler } from "@/features/asset-places/components/PlaceReconciler";

export interface ShellProps {
  children: ReactNode;
  modal: ReactNode;
}

export function Shell({ children, modal }: ShellProps) {
  useTrackNavigation();
  return (
    <>
      <OutboxSync />
      <AssetPlacesProvider>
        <PlaceReconciler />
        <AppShellV2 modal={modal}>{children}</AppShellV2>
      </AssetPlacesProvider>
    </>
  );
}
