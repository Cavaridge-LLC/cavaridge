import { useState } from "react";
import { FileText, FileCode, FileDown, Loader2 } from "lucide-react";

interface Props {
  onSubmit: (brief: {
    description: string;
    outputFormat: string;
    audience: string;
    tone: string;
    referenceNotes: string;
  }) => void;
  loading: boolean;
}

const FORMAT_OPTIONS = [
  { value: "docx", label: "Word Document", icon: FileText, description: "Professional .docx file" },
  { value: "pdf", label: "PDF", icon: FileDown, description: "Print-ready PDF" },
  { value: "markdown", label: "Markdown", icon: FileCode, description: "Developer-friendly .md" },
];

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "creative", label: "Creative" },
  { value: "technical", label: "Technical" },
  { value: "academic", label: "Academic" },
];

export default function BriefIntakeForm({ onSubmit, loading }: Props) {
  const [description, setDescription] = useState("");
  const [outputFormat, setOutputFormat] = useState("docx");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("professional");
  const [referenceNotes, setReferenceNotes] = useState("");
  const [step, setStep] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ description, outputFormat, audience, tone, referenceNotes });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step 1: Describe */}
      {step >= 1 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            What would you like to create?
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your document in detail. E.g., 'A 5-page market analysis report on the cybersecurity industry for SMBs, covering trends, key vendors, and recommended strategies...'"
            className="w-full min-h-[120px] px-4 py-3 rounded-lg border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none resize-y"
            required
          />
          {step === 1 && description.length > 10 && (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm text-primary hover:underline"
            >
              Next: Choose format
            </button>
          )}
        </div>
      )}

      {/* Step 2: Format */}
      {step >= 2 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Output Format</label>
          <div className="grid grid-cols-3 gap-3">
            {FORMAT_OPTIONS.map((fmt) => (
              <button
                key={fmt.value}
                type="button"
                onClick={() => { setOutputFormat(fmt.value); setStep(3); }}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition ${
                  outputFormat === fmt.value
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <fmt.icon className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">{fmt.label}</span>
                <span className="text-xs text-muted-foreground">{fmt.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Audience & Tone */}
      {step >= 3 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Audience</label>
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g., C-suite executives, IT managers"
              className="w-full px-4 py-2 rounded-lg border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
            >
              {TONE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Step 4: Additional Notes */}
      {step >= 3 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Additional Notes <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            value={referenceNotes}
            onChange={(e) => setReferenceNotes(e.target.value)}
            placeholder="Any specific requirements, data to include, or references..."
            className="w-full min-h-[80px] px-4 py-3 rounded-lg border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none resize-y"
          />
        </div>
      )}

      {/* Submit */}
      {step >= 3 && (
        <button
          type="submit"
          disabled={loading || !description}
          className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing brief...
            </>
          ) : (
            "Get Cost Estimate"
          )}
        </button>
      )}
    </form>
  );
}
