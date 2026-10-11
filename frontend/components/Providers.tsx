"use client";

import React, { ReactNode } from "react";
import { LanguageProvider } from "@/lib/i18n";
import { ConsentModal } from "@/components/ConsentModal";
import { ThemeProvider } from "@/components/ThemeProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ConsentModal />
        {children}
      </LanguageProvider>
    </ThemeProvider>
  );
}
