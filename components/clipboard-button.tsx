"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ClipboardButtonProps = {
  text: string;
  label: string;
  className?: string;
};

export function ClipboardButton({ text, label, className }: ClipboardButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setError("");
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
          setError("Clipboard unavailable");
          window.setTimeout(() => setError(""), 1800);
        }
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[22px] border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-card transition hover:border-teal/30 hover:text-teal",
        className
      )}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : error || label}
    </button>
  );
}
