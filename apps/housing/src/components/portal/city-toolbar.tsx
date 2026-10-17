"use client";

import { Building2, MapPin } from "lucide-react";

import type { PortalController } from "@/components/portal/use-portal-controller";

export function CityToolbar({ ctl }: { ctl: PortalController }) {
  const { activeTab, filteredTotal, setActiveTab } = ctl;
  return (
    <>
      {/* Tab navigation (the city selector lives in the filter bar) */}
      <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap border-b pb-2 sm:flex-wrap sm:gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab("properties")}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-3 ${
            activeTab === "properties"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-accent"
          }`}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="hidden sm:inline">Ranking de </span>Imóveis (
            {filteredTotal})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("neighborhoods")}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-3 ${
            activeTab === "neighborhoods"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-accent"
          }`}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span>Top Bairros</span>
        </button>
      </div>
    </>
  );
}
