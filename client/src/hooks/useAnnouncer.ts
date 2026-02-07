import { useCallback, useEffect, useRef, useState } from "react";
import { generateSpeech, isAnnouncerAvailable } from "../lib/neocortexTts";

const MAX_QUEUE = 2;

export function useAnnouncer() {
  const available = isAnnouncerAvailable();
  const [muted, setMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlsRef = useRef<string[]>([]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of blobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;
    setIsSpeaking(true);

    while (queueRef.current.length > 0) {
      const text = queueRef.current.shift()!;

      try {
        const blob = await generateSpeech(text);
        const url = URL.createObjectURL(blob);
        blobUrlsRef.current.push(url);

        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(url);
          currentAudioRef.current = audio;
          audio.onended = () => {
            currentAudioRef.current = null;
            URL.revokeObjectURL(url);
            blobUrlsRef.current = blobUrlsRef.current.filter((u) => u !== url);
            resolve();
          };
          audio.onerror = () => {
            currentAudioRef.current = null;
            URL.revokeObjectURL(url);
            blobUrlsRef.current = blobUrlsRef.current.filter((u) => u !== url);
            reject(new Error("Audio playback failed"));
          };
          audio.play().catch(reject);
        });
      } catch (err) {
        console.error("[Announcer] TTS error:", err);
      }
    }

    processingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const announce = useCallback(
    (text: string) => {
      if (!available || muted || !text?.trim()) return;

      // Drop oldest if backlogged
      if (queueRef.current.length >= MAX_QUEUE) {
        queueRef.current.shift();
      }
      queueRef.current.push(text.trim());
      processQueue();
    },
    [available, muted, processQueue],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (next) {
        // Stop current audio and clear queue
        queueRef.current = [];
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        setIsSpeaking(false);
      }
      return next;
    });
  }, []);

  return { announce, muted, toggleMute, isSpeaking, available };
}
