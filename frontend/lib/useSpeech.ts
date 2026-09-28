"use client";
import { useEffect, useRef, useState } from "react";

// Shared play/stop logic for every "Listen" button on the site (a follow-up answer, or the whole report).
// One id at a time: starting a new clip stops whatever else is playing. Each id's audio is cached (as an
// object URL) after its first fetch, so clicking the same button again replays instantly with no new API call.
export function useSpeech() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    return () => {
      audioElRef.current?.pause();
      cacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function toggle(id: string, fetchAudioBase64: () => Promise<string>) {
    audioElRef.current?.pause();
    if (playingId === id) {
      setPlayingId(null);
      return;
    }
    const play = (url: string) => {
      const el = new Audio(url);
      audioElRef.current = el;
      el.onended = () => setPlayingId(null);
      setPlayingId(id);
      el.play().catch(() => setPlayingId(null));
    };
    const cached = cacheRef.current.get(id);
    if (cached) return play(cached);

    setLoadingId(id);
    try {
      const b64 = await fetchAudioBase64();
      const blob = await (await fetch(`data:audio/mp3;base64,${b64}`)).blob();
      const url = URL.createObjectURL(blob);
      cacheRef.current.set(id, url);
      play(url);
    } catch {
      // TTS unavailable (network, quota, etc.) — the text is still on screen either way.
    } finally {
      setLoadingId(null);
    }
  }

  return { playingId, loadingId, toggle };
}
