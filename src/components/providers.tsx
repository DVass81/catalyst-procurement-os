"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConversationProvider } from "@elevenlabs/react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useState } from "react";

import { DemoProvider } from "@/components/demo/demo-provider";
import { CatalystGuideProvider } from "@/components/guide/catalyst-guide-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Number.POSITIVE_INFINITY,
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <DemoProvider>
          <ConversationProvider>
            <CatalystGuideProvider>{children}</CatalystGuideProvider>
          </ConversationProvider>
        </DemoProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
