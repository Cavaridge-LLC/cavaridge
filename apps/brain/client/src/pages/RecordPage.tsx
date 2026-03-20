/**
 * Record Page — Voice-First Knowledge Capture (Dump Mode)
 *
 * Primary interface: big mic button, live transcript, waveform visualization.
 * Zero-friction — user presses record, talks, presses stop.
 * System handles everything else.
 */

import { useState, useCallback } from "react";
import { Mic, MicOff, Square, Send, Trash2, Loader2 } from "lucide-react";
import { useVoiceCapture } from "../hooks/useVoiceCapture.js";
import { api } from "../hooks/useApi.js";

export function RecordPage() {
  const voice = useVoiceCapture();
  const [processing, setProcessing] = useState(false);
  const [extraction, setExtraction] = useState<Record<string, unknown> | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const handleStartRecording = useCallback(async () => {
    try {
      const recording = await api.createRecording({ sourceType: "microphone" });
      setRecordingId(recording.id);
      setExtraction(null);
      voice.startRecording();
    } catch {
      voice.startRecording();
    }
  }, [voice]);

  const handleStopRecording = useCallback(() => {
    voice.stopRecording();
  }, [voice]);

  const handleProcess = useCallback(async () => {
    if (!voice.transcript.trim()) return;
    setProcessing(true);
    try {
      const id = recordingId || crypto.randomUUID();

      // Submit transcript
      await api.submitWebSpeech(id, {
        text: voice.transcript,
        confidence: 0.85,
      });

      // Trigger knowledge extraction
      const result = await api.processRecording(id, {
        transcript: voice.transcript,
      });

      setExtraction(result.extraction as Record<string, unknown>);
    } catch (err) {
      console.error("Processing failed:", err);
    } finally {
      setProcessing(false);
    }
  }, [voice.transcript, recordingId]);

  const handleReset = useCallback(() => {
    voice.resetTranscript();
    setExtraction(null);
    setRecordingId(null);
  }, [voice]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[var(--brain-text)]">Voice Capture</h1>
        <p className="text-sm text-[var(--brain-text-muted)] mt-1">Talk. Brain structures and stores.</p>
      </div>

      {/* Recording Status */}
      {voice.isRecording && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-3 h-3 rounded-full bg-[var(--brain-recording)] animate-pulse-recording" />
          <span className="text-sm font-medium text-[var(--brain-recording)]">Recording</span>
          <span className="text-sm font-mono text-[var(--brain-text-muted)]">{formatDuration(voice.duration)}</span>
        </div>
      )}

      {/* Waveform Visualization */}
      {voice.isRecording && (
        <div className="flex items-center gap-1 h-8 mb-6">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="w-1 bg-[var(--brain-primary)] rounded-full animate-waveform"
              style={{ animationDelay: `${i * 0.05}s`, animationDuration: `${0.5 + Math.random() * 0.5}s` }}
            />
          ))}
        </div>
      )}

      {/* Big Mic Button */}
      <button
        onClick={voice.isRecording ? handleStopRecording : handleStartRecording}
        disabled={!voice.isSupported}
        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
          voice.isRecording
            ? "bg-[var(--brain-recording)] hover:bg-red-600 scale-110"
            : "bg-[var(--brain-primary)] hover:bg-blue-700"
        } ${!voice.isSupported ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} text-white`}
      >
        {voice.isRecording ? (
          <Square className="w-10 h-10" />
        ) : (
          <Mic className="w-10 h-10" />
        )}
      </button>

      {!voice.isSupported && (
        <p className="text-sm text-[var(--brain-recording)] mt-3">
          Speech recognition not supported in this browser. Use Chrome or Edge.
        </p>
      )}

      {voice.error && (
        <p className="text-sm text-[var(--brain-recording)] mt-3">{voice.error}</p>
      )}

      {/* Live Transcript */}
      <div className="w-full max-w-2xl mt-8">
        {(voice.transcript || voice.interimTranscript) && (
          <div className="bg-[var(--brain-surface-alt)] rounded-xl p-4 border border-[var(--brain-border)]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-[var(--brain-text-muted)]">Transcript</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Clear"
                >
                  <Trash2 className="w-4 h-4 text-[var(--brain-text-muted)]" />
                </button>
              </div>
            </div>
            <p className="text-[var(--brain-text)] leading-relaxed">
              {voice.transcript}
              {voice.interimTranscript && (
                <span className="text-[var(--brain-text-muted)] italic">{voice.interimTranscript}</span>
              )}
            </p>
          </div>
        )}

        {/* Process Button */}
        {voice.transcript && !voice.isRecording && (
          <div className="flex justify-center mt-4">
            <button
              onClick={handleProcess}
              disabled={processing}
              className="flex items-center gap-2 px-6 py-2.5 bg-[var(--brain-primary)] text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extracting Knowledge...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Extract Knowledge
                </>
              )}
            </button>
          </div>
        )}

        {/* Extraction Results */}
        {extraction && (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--brain-text)]">Extracted Knowledge</h2>

            {/* Language Analysis */}
            {(extraction as Record<string, unknown>).languageAnalysis && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Tone:</strong> {((extraction as Record<string, Record<string, string>>).languageAnalysis).toneDetected} |{" "}
                  <strong>Formality:</strong> {((extraction as Record<string, Record<string, string>>).languageAnalysis).formality} |{" "}
                  <strong>Topic:</strong> {((extraction as Record<string, Record<string, string>>).languageAnalysis).topicSummary}
                </p>
              </div>
            )}

            {/* Knowledge Objects */}
            {Array.isArray((extraction as Record<string, unknown[]>).knowledgeObjects) &&
              ((extraction as Record<string, unknown[]>).knowledgeObjects).map((ko: unknown, i: number) => {
                const obj = ko as Record<string, unknown>;
                const typeColors: Record<string, string> = {
                  decision: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
                  action_item: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
                  fact: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
                  question: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
                  insight: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200",
                  meeting_note: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
                  reference: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200",
                };

                return (
                  <div key={i} className="bg-[var(--brain-surface-alt)] rounded-lg p-4 border border-[var(--brain-border)]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[obj.type as string] || typeColors.fact}`}>
                        {(obj.type as string || "").replace("_", " ")}
                      </span>
                      <span className="text-xs text-[var(--brain-text-muted)]">
                        {Math.round((obj.confidence as number || 0) * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-[var(--brain-text)]">{obj.content as string}</p>
                    {obj.summary && (
                      <p className="text-xs text-[var(--brain-text-muted)] mt-1 italic">{obj.summary as string}</p>
                    )}
                    {Array.isArray(obj.tags) && (obj.tags as string[]).length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {(obj.tags as string[]).map((tag: string, j: number) => (
                          <span key={j} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[var(--brain-text-muted)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Summary */}
            <p className="text-sm text-[var(--brain-text-muted)] text-center">
              {(extraction as Record<string, number>).totalObjectsExtracted || 0} knowledge objects extracted
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
