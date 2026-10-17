"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeProvider";
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
  FileText,
  Award,
  ChevronDown,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/twin", label: "Digital Twin", icon: Layers },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/alerts", label: "Alerts", icon: Bell, badge: "3", badgeColor: "bg-amber-500" },
  { href: "/performance", label: "Performance", icon: BarChart3 },
];

const MORE_NAV: NavItem[] = [
  { href: "/how-it-works", label: "Methodology", icon: BookOpen },
  { href: "/model-card", label: "Model Card", icon: FileText },
  { href: "/population", label: "Population", icon: PieChart },
  { href: "/audit", label: "Audit & Privacy", icon: ShieldCheck },
  { href: "/india", label: "India Context", icon: MapPin },
  { href: "/import", label: "Import Data", icon: Database },
  { href: "/about", label: "About & Charter", icon: Award },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close "More" dropdown on click outside and handle Escape key for accessibility
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreMenuOpen(false);
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const isMoreActive = MORE_NAV.some(
    (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
  );

  return (
    <>
      <header className="sticky top-0 z-40 glass-navbar transition-colors no-print print:hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-white font-serif font-bold text-base sm:text-lg shadow-md group-hover:scale-105 transition-transform duration-200">
                V
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-editorial text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                    VitalTwin
                  </span>
                  <span className="hidden min-[380px]:inline-block text-[9px] sm:text-[10px] font-mono tracking-wider uppercase text-[var(--color-primary)] bg-[rgba(37,99,235,0.08)] dark:bg-[rgba(96,165,250,0.12)] border border-[rgba(37,99,235,0.2)] dark:border-[rgba(96,165,250,0.25)] px-1.5 sm:px-2 py-0.5 rounded-full font-semibold">
                    Clinical Twin
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] -mt-0.5 hidden sm:block tracking-wide">
                  A Living Digital Perspective on Health
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links (Clean & Concise) */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-medium" aria-label="Desktop Navigation">
            {PRIMARY_NAV.map((item) => {
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
                      aria-label={`${item.badge} notifications`}
                    />
                  )}
                </Link>
              );
            })}

            {/* "More" Dropdown Menu */}
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                aria-expanded={moreMenuOpen}
                aria-haspopup="true"
                className={`px-3 py-1.5 rounded-xl transition-all duration-180 flex items-center gap-1.5 cursor-pointer ${
                  isMoreActive
                    ? "bg-[rgba(37,99,235,0.12)] dark:bg-[rgba(96,165,250,0.16)] text-[var(--color-primary)] font-semibold border border-[rgba(37,99,235,0.25)] dark:border-[rgba(96,165,250,0.3)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.4)] dark:hover:bg-[rgba(255,255,255,0.05)] border border-transparent"
                }`}
              >
                <span>More</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${moreMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {moreMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 glass-modal p-1.5 shadow-xl rounded-xl border border-[var(--glass-border)] z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  {MORE_NAV.map((subItem) => {
                    const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href);
                    const SubIcon = subItem.icon;
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        onClick={() => setMoreMenuOpen(false)}
                        className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-2.5 transition-all ${
                          isSubActive
                            ? "bg-[rgba(37,99,235,0.12)] text-[var(--color-primary)] font-semibold"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                        }`}
                      >
                        <SubIcon className="w-3.5 h-3.5 opacity-80" />
                        <span>{subItem.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
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
              className="md:hidden p-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-strong)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            id="mobile-nav-drawer"
            className="md:hidden px-3 sm:px-4 pt-2 pb-4 glass-card mx-2 sm:mx-3 my-2 border border-[var(--glass-border)] shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 max-h-[calc(100vh-5rem)] overflow-y-auto"
          >
            <div className="flex flex-col gap-1 text-sm font-medium pt-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] px-3 pt-1">
                Main
              </span>
              {PRIMARY_NAV.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-2 rounded-xl flex items-center justify-between transition-colors min-h-[44px] ${
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

              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] px-3 pt-2 border-t border-[var(--glass-border)] mt-1">
                More Resources
              </span>
              {MORE_NAV.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs transition-colors min-h-[40px] ${
                      isActive
                        ? "bg-[rgba(37,99,235,0.15)] text-[var(--color-primary)] font-semibold"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <Icon className="w-4 h-4 opacity-80" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="pt-3 mt-2 border-t border-[var(--glass-border)] flex items-center justify-end">
                <Link
                  href="/twin?patient=PT-101"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold glass-btn-primary min-h-[40px] flex items-center"
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
