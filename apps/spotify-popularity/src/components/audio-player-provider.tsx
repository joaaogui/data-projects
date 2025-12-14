"use client"

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from "react"

interface AudioPlayerContextType {
  currentTrackId: string | null
  isPlaying: boolean
  play: (trackId: string, previewUrl: string) => void
  pause: () => void
  toggle: (trackId: string, previewUrl: string) => void
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null)

export function AudioPlayerProvider({ children }: Readonly<{ children: ReactNode }>) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    audioRef.current = new Audio()
    audioRef.current.volume = 0.5

    const audio = audioRef.current

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTrackId(null)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("play", handlePlay)

    return () => {
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("play", handlePlay)
      audio.pause()
    }
  }, [])

  const play = useCallback((trackId: string, previewUrl: string) => {
    if (!audioRef.current) return

    if (currentTrackId !== trackId) {
      audioRef.current.src = previewUrl
      setCurrentTrackId(trackId)
    }

    audioRef.current.play().catch(console.error)
  }, [currentTrackId])

  const pause = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.pause()
  }, [])

  const toggle = useCallback((trackId: string, previewUrl: string) => {
    if (currentTrackId === trackId && isPlaying) {
      pause()
    } else {
      play(trackId, previewUrl)
    }
  }, [currentTrackId, isPlaying, play, pause])

  const value = useMemo(() => ({
    currentTrackId,
    isPlaying,
    play,
    pause,
    toggle,
  }), [currentTrackId, isPlaying, play, pause, toggle])

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  )
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext)
  if (!context) {
    throw new Error("useAudioPlayer must be used within an AudioPlayerProvider")
  }
  return context
}

