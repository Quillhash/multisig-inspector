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
    <div className="border-b border-rule p-2" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={active === tab.value}
          className={cn(
            "rounded px-3 py-2 text-sm font-semibold whitespace-nowrap transition",
            active === tab.value ? "bg-accent text-white" : "text-muted hover:text-foreground",
          )}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
