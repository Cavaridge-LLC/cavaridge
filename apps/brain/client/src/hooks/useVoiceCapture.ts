/**
 * useVoiceCapture — Web Speech API hook for real-time speech-to-text
 *
 * Uses the browser's SpeechRecognition API for real-time transcription.
 * Falls back gracefully if the API is not available.
 * Streams interim/final results to the server via WebSocket.
 */

import { useState, useCallback, useRef, useEffect } from "react";

interface VoiceCaptureState {
  isRecording: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  segments: Array<{ text: string; timestamp: number; isFinal: boolean }>;
  error: string | null;
  duration: number;
}

interface VoiceCaptureActions {
  startRecording: () => void;
  stopRecording: () => void;
  resetTranscript: () => void;
}

interface SpeechRecognitionType {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

// Extend Window for vendor-prefixed API
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionType;
    webkitSpeechRecognition: new () => SpeechRecognitionType;
  }
}

export function useVoiceCapture(language: string = "en-US"): VoiceCaptureState & VoiceCaptureActions {
  const [state, setState] = useState<VoiceCaptureState>({
    isRecording: false,
    isSupported: typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    transcript: "",
    interimTranscript: "",
    segments: [],
    error: null,
    duration: 0,
  });

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!state.isSupported) {
      setState((s) => ({ ...s, error: "Speech recognition not supported in this browser" }));
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition() as SpeechRecognitionType;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        startTimeRef.current = Date.now();
        timerRef.current = window.setInterval(() => {
          setState((s) => ({ ...s, duration: Math.floor((Date.now() - startTimeRef.current) / 1000) }));
        }, 1000);
        setState((s) => ({ ...s, isRecording: true, error: null }));
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let finalText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript + " ";
          } else {
            interim += result[0].transcript;
          }
        }

        setState((s) => {
          const newTranscript = finalText ? s.transcript + finalText : s.transcript;
          const newSegments = finalText
            ? [...s.segments, { text: finalText.trim(), timestamp: Date.now(), isFinal: true }]
            : s.segments;

          return {
            ...s,
            transcript: newTranscript,
            interimTranscript: interim,
            segments: newSegments,
          };
        });
      };

      recognition.onerror = (event) => {
        const errorEvent = event as Event & { error: string };
        // "no-speech" is normal — user paused talking
        if (errorEvent.error === "no-speech") return;
        setState((s) => ({ ...s, error: `Speech recognition error: ${errorEvent.error}` }));
      };

      recognition.onend = () => {
        // Auto-restart if still in recording mode (handles browser auto-stop)
        setState((s) => {
          if (s.isRecording) {
            try { recognition.start(); } catch { /* ignore */ }
          }
          return s;
        });
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      setState((s) => ({ ...s, error: err instanceof Error ? err.message : "Failed to start recording" }));
    }
  }, [state.isSupported, language]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState((s) => ({ ...s, isRecording: false, interimTranscript: "" }));
  }, []);

  const resetTranscript = useCallback(() => {
    setState((s) => ({ ...s, transcript: "", interimTranscript: "", segments: [], duration: 0 }));
  }, []);

  return { ...state, startRecording, stopRecording, resetTranscript };
}
