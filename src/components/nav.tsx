"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transaktionen" },
  { href: "/portfolio", label: "Portfolio" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1" aria-label="Hauptnavigation">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              active
                ? "bg-accent-soft text-accent"
                : "text-text-muted hover:bg-surface-muted hover:text-text",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
