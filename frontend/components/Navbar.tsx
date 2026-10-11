"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeProvider";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  Activity,
  Layers,
  Users,
  PieChart,
  BarChart3,
  BookOpen,
  MapPin,
  ShieldCheck,
  Bell,
  Menu,
  X,
  ArrowRight,
  Database,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/twin", label: "Digital Twin", icon: Layers },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/population", label: "Population", icon: PieChart },
  { href: "/performance", label: "Model Metrics", icon: BarChart3 },
  { href: "/how-it-works", label: "How It Works", icon: BookOpen },
  { href: "/india", label: "India Context", icon: MapPin },
  { href: "/audit", label: "Audit & Privacy", icon: ShieldCheck },
  { href: "/alerts", label: "Alerts", icon: Bell, badge: "3", badgeColor: "bg-amber-500" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 glass-navbar transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-white font-serif font-bold text-lg shadow-md group-hover:scale-105 transition-transform duration-200">
                Ψ
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-editorial text-xl font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                    TwinCare
                  </span>
                  <span className="text-[10px] font-mono tracking-wider uppercase text-[var(--color-primary)] bg-[rgba(37,99,235,0.08)] dark:bg-[rgba(96,165,250,0.12)] border border-[rgba(37,99,235,0.2)] dark:border-[rgba(96,165,250,0.25)] px-2 py-0.5 rounded-full font-semibold">
                    Pramana Twin
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] -mt-0.5 hidden sm:block tracking-wide">
                  Hypertension Decompensation Intelligence
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1 text-xs font-medium">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-xl transition-all duration-180 flex items-center gap-1.5 relative ${
                    isActive
                      ? "bg-[rgba(37,99,235,0.12)] dark:bg-[rgba(96,165,250,0.16)] text-[var(--color-primary)] font-semibold shadow-2xs border border-[rgba(37,99,235,0.25)] dark:border-[rgba(96,165,250,0.3)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.4)] dark:hover:bg-[rgba(255,255,255,0.05)] border border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${item.badgeColor || "bg-blue-500"} animate-pulse`}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Compact Tablet Navigation (< xl, >= md) */}
          <nav className="hidden md:flex xl:hidden items-center gap-1 text-xs font-medium">
            <Link
              href="/"
              className={`px-2.5 py-1.5 rounded-lg ${
                pathname === "/" ? "bg-[rgba(37,99,235,0.12)] text-[var(--color-primary)] font-semibold" : "text-[var(--text-secondary)]"
              }`}
            >
              Overview
            </Link>
            <Link
              href="/twin"
              className={`px-2.5 py-1.5 rounded-lg ${
                pathname.startsWith("/twin") ? "bg-[rgba(37,99,235,0.12)] text-[var(--color-primary)] font-semibold" : "text-[var(--text-secondary)]"
              }`}
            >
              Twin
            </Link>
            <Link
              href="/patients"
              className={`px-2.5 py-1.5 rounded-lg ${
                pathname.startsWith("/patients") ? "bg-[rgba(37,99,235,0.12)] text-[var(--color-primary)] font-semibold" : "text-[var(--text-secondary)]"
              }`}
            >
              Patients
            </Link>
            <Link
              href="/population"
              className={`px-2.5 py-1.5 rounded-lg ${
                pathname.startsWith("/population") ? "bg-[rgba(37,99,235,0.12)] text-[var(--color-primary)] font-semibold" : "text-[var(--text-secondary)]"
              }`}
            >
              Population
            </Link>
            <Link
              href="/performance"
              className={`px-2.5 py-1.5 rounded-lg ${
                pathname.startsWith("/performance") ? "bg-[rgba(37,99,235,0.12)] text-[var(--color-primary)] font-semibold" : "text-[var(--text-secondary)]"
              }`}
            >
              Metrics
            </Link>
            <Link
              href="/audit"
              className={`px-2.5 py-1.5 rounded-lg ${
                pathname.startsWith("/audit") ? "bg-[rgba(37,99,235,0.12)] text-[var(--color-primary)] font-semibold" : "text-[var(--text-secondary)]"
              }`}
            >
              Audit
            </Link>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="hidden sm:block">
              <LanguageSelector compact />
            </div>

            {/* Dark / Light Theme Toggle Switcher */}
            <ThemeToggle />

            {/* Quick Patient CTA */}
            <Link
              href="/twin?patient=PT-101"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold glass-btn-primary shadow-xs"
              title="Open Digital Twin for patient PT-101"
            >
              <span>PT-101</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-strong)] transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden px-4 pt-2 pb-4 glass-card mx-3 my-2 border border-[var(--glass-border)] animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-1 text-sm font-medium pt-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                      isActive
                        ? "bg-[rgba(37,99,235,0.15)] text-[var(--color-primary)] font-semibold border border-[rgba(37,99,235,0.2)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 opacity-80" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-bold border border-amber-500/30">
                        {item.badge} New
                      </span>
                    )}
                  </Link>
                );
              })}
              <div className="pt-3 mt-2 border-t border-[var(--glass-border)] flex items-center justify-between">
                <LanguageSelector />
                <Link
                  href="/twin?patient=PT-101"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold glass-btn-primary"
                >
                  PT-101 Twin →
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
