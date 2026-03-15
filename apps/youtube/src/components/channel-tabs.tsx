"use client";

import { BookOpen, Calendar, TableProperties } from "lucide-react";

export type TabId = "videos" | "timeline" | "sagas";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}

function TabButton({ active, onClick, icon, label, count }: Readonly<TabButtonProps>) {
  return (
    <button
      role="tab"
      id={`tab-${label.toLowerCase()}`}
      aria-selected={active}
      aria-controls={`tabpanel-${label.toLowerCase()}`}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 ${active
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-95"
        }`}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className={`text-xs tabular-nums rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${active ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted/80 text-muted-foreground/60"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

export interface ChannelTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  counts?: Partial<Record<TabId, number>>;
}

export function ChannelTabs({ activeTab, onTabChange, counts }: Readonly<ChannelTabsProps>) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
      <div role="tablist" aria-label="Channel views" className="relative flex items-center gap-1 mb-3 flex-shrink-0 rounded-2xl bg-muted/30 p-1.5">
        <TabButton
          active={activeTab === "videos"}
          onClick={() => onTabChange("videos")}
          icon={<TableProperties className="h-3.5 w-3.5" />}
          label="Videos"
          count={counts?.videos}
        />
        <TabButton
          active={activeTab === "timeline"}
          onClick={() => onTabChange("timeline")}
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="Timeline"
          count={counts?.timeline}
        />
        <TabButton
          active={activeTab === "sagas"}
          onClick={() => onTabChange("sagas")}
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="Sagas"
          count={counts?.sagas}
        />
      </div>
    </div>
  );
}
