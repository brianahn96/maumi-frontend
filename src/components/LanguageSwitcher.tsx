import { Globe } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const opts: { value: Lang; label: string }[] = [
    { value: "en", label: "EN" },
    { value: "ko", label: "한" },
  ];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-border/60 bg-background/60 p-0.5 text-xs",
        className,
      )}
    >
      <Globe className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          className={cn(
            "rounded-lg px-2 py-1 font-medium transition",
            lang === o.value
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={lang === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
