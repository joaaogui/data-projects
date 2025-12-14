"use client"

import { useState } from "react"
import Image from "next/image"
import { Play, Pause, ExternalLink, Loader2 } from "lucide-react"
import { useAudioPlayer } from "./audio-player-provider"
import { useTrackPreview } from "@/hooks/use-track-preview"

interface TrackCoverProps {
  trackId: string
  trackName: string
  artistName: string
  imageUrl: string | undefined
  albumName: string
  spotifyUrl: string
}

export function TrackCover({
  trackId,
  trackName,
  artistName,
  imageUrl,
  albumName,
  spotifyUrl,
}: Readonly<TrackCoverProps>) {
  const { currentTrackId, isPlaying, toggle } = useAudioPlayer()
  const [shouldFetch, setShouldFetch] = useState(false)

  const { data, isFetching: isLoading } = useTrackPreview({
    trackName,
    artistName,
    enabled: shouldFetch,
  })

  const previewUrl = data?.preview ?? null
  const previewFetched = shouldFetch && !isLoading

  const isCurrentTrack = currentTrackId === trackId
  const isThisPlaying = isCurrentTrack && isPlaying

                      
  const handleMouseEnter = () => {
    if (!shouldFetch) {
      setShouldFetch(true)
    }
  }

  const handleClick = () => {
                                                 
    if (isCurrentTrack && isPlaying) {
      toggle(trackId, previewUrl!)
      return
    }

                                    
    if (previewUrl) {
      toggle(trackId, previewUrl)
      return
    }

                                    
    if (isLoading) {
      return
    }

                                                                  
    if (shouldFetch) {
                                                             
      window.open(spotifyUrl, "_blank", "noopener,noreferrer")
    } else {
      setShouldFetch(true)
    }
  }

  if (!imageUrl) {
    return <div className="h-12 w-12 rounded-md bg-muted" />
  }

  const showExternalIcon = previewFetched && !previewUrl

  const getAriaLabel = () => {
    if (isThisPlaying) return "Pause"
    if (previewUrl) return "Play preview"
    return "Open in Spotify"
  }

  const renderIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-5 w-5 text-white drop-shadow-lg animate-spin" />
    }
    if (isThisPlaying) {
      return <Pause className="h-5 w-5 text-white drop-shadow-lg" fill="white" />
    }
    if (showExternalIcon) {
      return <ExternalLink className="h-4 w-4 text-white drop-shadow-lg" />
    }
    return <Play className="h-5 w-5 text-white drop-shadow-lg ml-0.5" fill="white" />
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className="group relative h-12 w-12 overflow-hidden rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-spotify focus:ring-offset-2 focus:ring-offset-background"
      aria-label={getAriaLabel()}
    >
      <Image
        src={imageUrl}
        alt={albumName}
        fill
        className={`object-cover transition-all duration-200 group-hover:scale-105 group-hover:brightness-50 ${
          isThisPlaying ? "brightness-50" : ""
        }`}
        sizes="48px"
      />
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
          isThisPlaying || isLoading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {renderIcon()}
      </div>
      {isThisPlaying && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-spotify">
          <div className="h-full w-full bg-spotify animate-pulse" />
        </div>
      )}
    </button>
  )
}
