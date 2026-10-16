import type { Metadata } from "next";
import { Inter, Newsreader, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TwinCare · Pramana Clinical Digital Twin",
  description:
    "Longitudinal digital twin for 365-day hypertension decompensation risk modeling, SHAP explainability, and counterfactual what-if simulation. Research prototype presented at Happiest Health Summit 2026, Bengaluru.",
  keywords: [
    "digital twin",
    "hypertension",
    "healthcare",
    "Pramana",
    "cardiovascular risk",
    "XGBoost",
    "clinical decision support",
    "Bengaluru Summit 2026",
    "glassmorphism",
  ],
  authors: [{ name: "TwinCare Clinical Engineering" }],
  openGraph: {
    title: "TwinCare · Pramana Clinical Twin (Hypertension)",
    description: "Longitudinal hypertension digital twin prototype for 365-day trajectory exploration, SHAP explainability, and what-if simulations.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Synchronous theme initialization to prevent flash of wrong theme (FOUC) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var stored = localStorage.getItem('twincare-theme');
                var isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch(e) {}
            })()`,
          }}
        />
      </head>
      <body
        className="min-h-screen flex flex-col antialiased font-sans relative selection:bg-blue-500/20 selection:text-blue-700 dark:selection:text-blue-300"
        suppressHydrationWarning
      >
        {/* Layered background visual apparatus: Image + radial glows + subtle circuit grid */}
        <div className="twincare-bg-layer" aria-hidden="true" />
        <div className="twincare-bg-grid" aria-hidden="true" />

        <Providers>
          {/* Summit Top Glass Banner */}
          <div className="relative z-50 bg-[rgba(8,145,178,0.92)] dark:bg-[rgba(15,29,48,0.88)] backdrop-blur-md text-white text-xs px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-1.5 border-b border-white/15 dark:border-[rgba(148,183,220,0.16)] transition-colors shadow-2xs">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-pulse shrink-0" />
              <span className="font-semibold tracking-wide uppercase text-[9px] sm:text-[10px] truncate">
                Happiest Health Summit 2026<span className="hidden sm:inline"> · Bengaluru</span>
              </span>
              <span className="text-white/60 hidden md:inline">|</span>
              <span className="text-white/90 hidden md:inline text-[11px]">Theme: Digital Twin in Healthcare</span>
            </div>
            <div className="text-white/85 text-[10px] sm:text-[11px] font-mono shrink-0">
              <span className="hidden xs:inline">Longitudinal </span>Hypertension Twin · 365d<span className="hidden sm:inline"> Horizon</span>
            </div>
          </div>

          {/* Sticky Glassmorphic Navbar */}
          <Navbar />

          {/* Main Content Area */}
          <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
            {children}
          </main>

          {/* Global Honest Disclaimer Glass Footer */}
          <footer className="relative z-10 mt-auto border-t border-[var(--glass-border)] bg-[var(--bg-surface)] backdrop-blur-lg py-5 sm:py-6 transition-colors">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 text-xs text-[var(--text-muted)] text-center md:text-left">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <p className="font-medium text-[var(--text-secondary)] text-[11px] sm:text-xs">
                  Prototype only. Not validated for clinical decisions. Dataset provenance: Synthea EHR.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] font-mono text-[var(--text-muted)]">
                <span>Happiest Health Summit 2026</span>
                <span>·</span>
                <span>Model v1.0.0</span>
                <span>·</span>
                <span>Bengaluru, India</span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
