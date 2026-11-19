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
            "rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
            active === tab.value ? "bg-foreground text-white" : "text-muted hover:bg-background hover:text-foreground",
          )}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
