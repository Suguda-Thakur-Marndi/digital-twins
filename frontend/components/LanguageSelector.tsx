"use client";

import React from "react";
import { useLanguage, Language } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();

  const options: Array<{ code: Language; label: string; native: string }> = [
    { code: "en", label: "English", native: "English" },
    { code: "hi", label: "Hindi", native: "हिन्दी" },
    { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  ];

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium">
      <Globe className="w-3.5 h-3.5 text-[var(--accent-teal)] shrink-0" />
      <div className="flex rounded border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-0.5">
        {options.map((opt) => (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLanguage(opt.code)}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors font-mono ${
              language === opt.code
                ? "bg-white text-[var(--accent-teal)] font-bold shadow-2xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            title={`Switch to ${opt.label} (${opt.native})`}
          >
            {opt.native}
          </button>
        ))}
      </div>
    </div>
  );
}
