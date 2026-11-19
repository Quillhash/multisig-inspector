import { cn } from "@/lib/utils/cn";

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-rule p-2" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={active === tab.value}
          className={cn(
            "h-10 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors",
            active === tab.value ? "bg-surface text-foreground" : "text-muted hover:text-foreground",
          )}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
