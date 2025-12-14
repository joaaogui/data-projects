import { Music2 } from "lucide-react"

interface LogoProps {
  size?: "default" | "large"
  showText?: boolean
}

export function Logo({ size = "default", showText = true }: Readonly<LogoProps>) {
  const isLarge = size === "large"
  
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className={`
        relative flex items-center justify-center rounded-xl
        bg-gradient-to-br from-spotify to-emerald-600
        ${isLarge ? "h-16 w-16" : "h-8 w-8 sm:h-10 sm:w-10"}
        shadow-lg shadow-spotify/25 shrink-0
      `}>
        <Music2 className={`text-black ${isLarge ? "h-8 w-8" : "h-4 w-4 sm:h-5 sm:w-5"}`} />
        <div className="absolute inset-0 rounded-xl bg-white/10" />
      </div>
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className={`font-bold tracking-tight ${isLarge ? "text-3xl" : "text-xl"}`}>
              Spotify
            </span>
          </div>
          <span className={`text-spotify font-medium ${isLarge ? "text-lg -mt-1" : "text-sm -mt-0.5"}`}>
            Popularity
          </span>
        </div>
      )}
    </div>
  )
}

