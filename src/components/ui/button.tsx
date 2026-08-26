"use client";

import { clsx } from "clsx";
import { useFormStatus } from "react-dom";

/**
 * Absende-Button, der seinen Pending-Zustand selbst kennt. Muss deshalb innerhalb
 * des <form> stehen, das er abschickt.
 */
export function SubmitButton({
  children,
  pendingLabel = "Speichern …",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(
        "inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium",
        "text-accent-contrast transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function DeleteButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      title={label}
      className="rounded-md px-2 py-1 text-xs text-text-muted transition hover:bg-negative-soft hover:text-negative disabled:opacity-50"
    >
      ✕
    </button>
  );
}
