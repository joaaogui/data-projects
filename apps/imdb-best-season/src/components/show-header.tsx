"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { SearchTitle } from "@/components/search-title";
import { Navbar } from "@data-projects/ui";
import type { Show } from "@/types/omdb";

interface ShowHeaderProps {
  searchQuery: string;
}

function IMDbLogo() {
  return (
    <Image
      src="/images/logo.png"
      alt="IMDb Best Season"
      width={60}
      height={38}
      className="dark:invert dark:brightness-200 h-6 w-auto sm:h-8"
      priority
    />
  );
}

export function ShowHeader({ searchQuery }: Readonly<ShowHeaderProps>) {
  return (
    <Navbar
      homeLink={<Link href="/" />}
      logo={<IMDbLogo />}
      appName="Best Season"
      search={<SearchTitle initialValue={searchQuery} compact />}
      themeIconClassName="text-gold"
    />
  );
}

export function ShowInfo({ show }: Readonly<{ show: Show }>) {
  return (
    <div data-testid="show-info" className="flex items-start gap-4 sm:gap-6 md:gap-8 animate-fade-in">
      {show.imageUrl && (
        <div className="shrink-0">
          <div className="relative w-24 sm:w-36 md:w-48 lg:w-56 aspect-[2/3] rounded-lg sm:rounded-xl overflow-hidden shadow-2xl ring-1 ring-border/50">
            <Image
              src={show.imageUrl}
              alt={show.name || "Show poster"}
              fill
              className="object-cover"
              data-testid="show-poster"
              sizes="(max-width: 640px) 96px, (max-width: 768px) 144px, (max-width: 1024px) 192px, 224px"
              priority
            />
          </div>
        </div>
      )}
      <div className="flex flex-col justify-center text-left min-w-0">
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <h1 data-testid="show-title" className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight truncate">
            {show.name}
          </h1>
          {show.imdbID && (
            <a
              href={`https://www.imdb.com/title/${show.imdbID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-gold transition-colors shrink-0"
              title="Open in IMDb"
            >
              <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sr-only">Open in IMDb</span>
            </a>
          )}
        </div>
        {show.description && (
          <p data-testid="show-description" className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed line-clamp-3 sm:line-clamp-none">
            {show.description}
          </p>
        )}
        {show.totalSeasons && (
          <p data-testid="show-seasons-count" className="mt-2 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
            <span className="font-semibold text-gold">{show.totalSeasons}</span>{" "}
            {show.totalSeasons === 1 ? "season" : "seasons"} ranked by IMDb ratings
          </p>
        )}
        {show.ratings && show.ratings.length > 0 && (
          <div className="flex flex-wrap gap-2 sm:gap-3 mt-3 sm:mt-4">
            {show.ratings.map((rating) => (
              <div
                key={rating.source}
                className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-muted/50 rounded-md text-xs sm:text-sm"
              >
                <span className="text-muted-foreground">{rating.source}:</span>
                <span className="font-semibold">{rating.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


