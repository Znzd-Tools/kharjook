import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { PortfolioProvider } from "@/features/portfolio/PortfolioProvider";
import { Shell } from "@/features/shell/components/Shell";
import { RateHistoryProvider } from "@/features/rates/components/RateHistoryProvider";
import { ToastProvider } from "@/shared/components/Toast";
import { ConfirmProvider } from "@/shared/components/ConfirmDialog";
import { DesignSystemProvider } from "@/design-system";
import { FlagsProvider } from "@/shared/lib/flags/client";
import { getFlags } from "@/shared/lib/flags/server";

export default async function AppLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const flags = await getFlags();

  return (
    <FlagsProvider initial={flags}>
      <DesignSystemProvider>
        <ToastProvider>
          <ConfirmProvider>
            <PortfolioProvider initialUser={user}>
              <RateHistoryProvider>
                <Shell modal={modal}>{children}</Shell>
              </RateHistoryProvider>
            </PortfolioProvider>
          </ConfirmProvider>
        </ToastProvider>
      </DesignSystemProvider>
    </FlagsProvider>
  );
}
