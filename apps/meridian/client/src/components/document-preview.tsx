import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  X, ArrowLeft, FileText, Eye, ZoomIn, ZoomOut, Maximize2, Minimize2,
  Copy, Search, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2,
  FileSpreadsheet, Mail, File, FileImage, Loader2, ExternalLink,
} from "lucide-react";

interface DocumentPreviewProps {
  documentId: string;
  onClose: () => void;
  defaultTab?: string;
  dealDocuments?: Array<{ id: string; filename: string }>;
}

interface PreviewMetadata {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  classification: string;
  extraction_status: string;
  preview_type: string;
  text_length: number;
  chunk_count: number;
  finding_count: number;
  content_hash: string;
  created_at: string;
  parent_archive_id: string | null;
  folder_path: string | null;
  deal_id: string;
  vision_analysis: any;
  extracted_text_preview: string | null;
}

interface DetailedMetadata extends PreviewMetadata {
  deal_name: string;
  parent_archive: { id: string; filename: string } | null;
  extracted_text: string | null;
  findings: Array<{
    id: string;
    title: string;
    severity: string;
    description: string;
    status: string;
    pillar_id: string;
    source_document_id: string | null;
  }>;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F59E0B",
  medium: "#EAB308",
  low: "#6B7280",
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  "Security Assessment": "#EF4444",
  "Network Infrastructure": "#3B82F6",
  "Cloud Infrastructure": "#06B6D4",
  "Application Architecture": "#8B5CF6",
  "Data Architecture": "#10B981",
  "Compliance & Regulatory": "#F59E0B",
  "HR & Organization": "#EC4899",
  "Financial Analysis": "#14B8A6",
  "Vendor & Licensing": "#F97316",
  "Business Continuity": "#6366F1",
  "Integration Planning": "#A855F7",
  "General": "#6B7280",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function ImagePreview({ documentId, onOpenLightbox }: { documentId: string; onOpenLightbox: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.25, Math.min(5, z + (e.deltaY > 0 ? -0.1 : 0.1))));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  }, [zoom, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--theme-border)]/30 bg-[var(--bg-panel)]">
        <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} className="p-1 rounded hover:bg-[var(--theme-border)]/30" data-testid="btn-zoom-out">
          <ZoomOut className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        </button>
        <span className="font-data text-[10px] text-[var(--text-disabled)] w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(5, z + 0.25))} className="p-1 rounded hover:bg-[var(--theme-border)]/30" data-testid="btn-zoom-in">
          <ZoomIn className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        </button>
        <button onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }} className="px-2 py-0.5 rounded text-[10px] text-[var(--text-secondary)] hover:bg-[var(--theme-border)]/30">
          Fit
        </button>
        <div className="flex-1" />
        <button onClick={onOpenLightbox} className="p-1 rounded hover:bg-[var(--theme-border)]/30" data-testid="btn-fullscreen">
          <Maximize2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        </button>
      </div>
      <div
        ref={imgRef}
        className="flex-1 overflow-hidden flex items-center justify-center bg-[var(--bg-primary)] cursor-grab"
        style={{ cursor: isDragging ? "grabbing" : zoom > 1 ? "grab" : "default" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={`/api/documents/${documentId}/preview?size=medium`}
          alt="Document preview"
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            transition: isDragging ? "none" : "transform 0.15s ease",
          }}
          draggable={false}
          data-testid="img-preview"
        />
      </div>
    </div>
  );
}

function PdfPreview({ documentId }: { documentId: string }) {
  return (
    <div className="h-full">
      <iframe
        src={`/api/documents/${documentId}/preview`}
        className="w-full h-full border-0"
        title="PDF Preview"
        data-testid="pdf-iframe"
      />
    </div>
  );
}

function TextPreview({ content, language }: { content: string; language: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const lines = content.split("\n");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--theme-border)]/30 bg-[var(--bg-panel)]">
        <div className="flex items-center gap-1 flex-1 bg-[var(--bg-primary)] rounded px-2 py-1 border border-[var(--theme-border)]/30">
          <Search className="w-3 h-3 text-[var(--text-disabled)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in text..."
            className="bg-transparent text-[10px] text-[var(--text-primary)] placeholder-[var(--text-disabled)] outline-none w-full font-data"
            data-testid="input-text-search"
          />
        </div>
        <Badge variant="outline" className="text-[9px] font-data px-1.5 py-0 h-[16px] border-[#8B5CF6]/30 text-[#8B5CF6] no-default-hover-elevate no-default-active-elevate">
          {language}
        </Badge>
        <button onClick={handleCopy} className="p-1 rounded hover:bg-[var(--theme-border)]/30" data-testid="btn-copy-text">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-[var(--bg-panel)] p-3">
        <pre className="font-data text-[11px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
          {lines.map((line, i) => {
            const isMatch = searchQuery && line.toLowerCase().includes(searchQuery.toLowerCase());
            return (
              <div key={i} className={`flex ${isMatch ? "bg-[#F59E0B]/10" : ""}`}>
                <span className="text-[var(--text-disabled)] select-none w-10 text-right pr-3 flex-shrink-0">{i + 1}</span>
                <span className="flex-1">{line || " "}</span>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

function HtmlPreview({ html }: { html: string }) {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div
        className="prose prose-sm max-w-none text-[var(--text-primary)] [&_table]:border-collapse [&_table]:border [&_table]:border-[var(--theme-border)] [&_td]:border [&_td]:border-[var(--theme-border)]/50 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[var(--theme-border)] [&_th]:px-2 [&_th]:py-1 [&_th]:bg-[var(--bg-panel)] [&_h1]:text-[var(--text-primary)] [&_h2]:text-[var(--text-primary)] [&_h3]:text-[var(--text-primary)] [&_p]:text-[var(--text-secondary)] [&_li]:text-[var(--text-secondary)]"
        dangerouslySetInnerHTML={{ __html: html }}
        data-testid="html-preview"
      />
    </div>
  );
}

function SpreadsheetPreview({ html, sheets }: { html: string; sheets: string[] }) {
  const [activeSheet, setActiveSheet] = useState(0);

  const sheetHtmlParts = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const divs = doc.querySelectorAll("div[data-sheet]");
    if (divs.length === 0) return [html];
    return Array.from(divs).map((d) => d.innerHTML);
  }, [html]);

  return (
    <div className="flex flex-col h-full">
      {sheets.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--theme-border)]/30 bg-[var(--bg-panel)] overflow-x-auto">
          {sheets.map((sheet, i) => (
            <button
              key={sheet}
              onClick={() => setActiveSheet(i)}
              className={`px-2.5 py-1 rounded text-[10px] font-data transition-colors ${
                activeSheet === i
                  ? "bg-[#3B82F6]/20 text-[#3B82F6]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--theme-border)]/30"
              }`}
              data-testid={`btn-sheet-${i}`}
            >
              {sheet}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto p-3">
        <div
          className="[&_table]:w-full [&_table]:border-collapse [&_table]:text-[11px] [&_table]:font-data [&_td]:border [&_td]:border-[var(--theme-border)]/50 [&_td]:px-2 [&_td]:py-1 [&_td]:text-[var(--text-secondary)] [&_th]:border [&_th]:border-[var(--theme-border)] [&_th]:px-2 [&_th]:py-1.5 [&_th]:bg-[var(--bg-panel)] [&_th]:text-[var(--text-primary)] [&_th]:font-medium [&_tr:nth-child(even)_td]:bg-[var(--bg-panel)]/30"
          dangerouslySetInnerHTML={{ __html: sheetHtmlParts[activeSheet] || "" }}
          data-testid="spreadsheet-preview"
        />
      </div>
    </div>
  );
}

function SlidesPreview({ slides }: { slides: Array<{ number: number; text: string }> }) {
  return (
    <div className="flex-1 overflow-auto p-4 space-y-3">
      {slides.map((slide) => (
        <div
          key={slide.number}
          className="bg-[var(--bg-panel)] rounded-lg p-4 border border-[var(--theme-border)]/30"
          data-testid={`slide-${slide.number}`}
        >
          <Badge variant="outline" className="text-[9px] font-data px-1.5 py-0 h-[16px] border-[#8B5CF6]/30 text-[#8B5CF6] mb-2 no-default-hover-elevate no-default-active-elevate">
            Slide {slide.number}
          </Badge>
          <p className="font-data text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{slide.text}</p>
        </div>
      ))}
    </div>
  );
}

function EmailPreview({ data }: { data: { from: string; to: string; subject: string; date: string; body_html: string; body_text: string } }) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="space-y-2 mb-4 pb-4 border-b border-[var(--theme-border)]/30">
        {[
          { label: "From", value: data.from },
          { label: "To", value: data.to },
          { label: "Date", value: data.date ? new Date(data.date).toLocaleString() : "" },
          { label: "Subject", value: data.subject },
        ].map(({ label, value }) => value && (
          <div key={label} className="flex gap-2">
            <span className="text-[11px] text-[var(--text-disabled)] w-14 flex-shrink-0 font-medium">{label}:</span>
            <span className="text-[11px] text-[var(--text-primary)]">{value}</span>
          </div>
        ))}
      </div>
      {data.body_html ? (
        <div
          className="text-[12px] text-[var(--text-secondary)] leading-relaxed [&_a]:text-[#3B82F6] [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: data.body_html }}
          data-testid="email-body"
        />
      ) : (
        <pre className="font-data text-[11px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{data.body_text}</pre>
      )}
    </div>
  );
}

function DetailsTab({ metadata }: { metadata: DetailedMetadata }) {
  const clsColor = CLASSIFICATION_COLORS[metadata.classification || "General"] || "#6B7280";

  const details = [
    { label: "Filename", value: metadata.filename },
    { label: "File Type", value: metadata.file_type?.toUpperCase() },
    { label: "File Size", value: formatFileSize(metadata.file_size || 0) },
    { label: "Classification", value: metadata.classification, badge: true, color: clsColor },
    { label: "Extraction Status", value: metadata.extraction_status },
    { label: "Upload Date", value: metadata.created_at ? new Date(metadata.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "" },
    { label: "Deal", value: metadata.deal_name },
    { label: "Text Length", value: metadata.text_length ? `${formatNumber(metadata.text_length)} characters` : "None" },
    { label: "Chunks", value: String(metadata.chunk_count) },
    { label: "Content Hash", value: metadata.content_hash?.slice(0, 16) + "..." || "N/A", copyable: metadata.content_hash },
  ];

  if (metadata.parent_archive) {
    details.push({ label: "Parent Archive", value: metadata.parent_archive.filename });
  }
  if (metadata.folder_path) {
    details.push({ label: "Folder Path", value: metadata.folder_path });
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-3">
      <div className="space-y-2">
        {details.map(({ label, value, badge, color, copyable }) => (
          <div key={label} className="flex items-start gap-3 py-1.5 border-b border-[var(--theme-border)]/20 last:border-0">
            <span className="text-[10px] text-[var(--text-disabled)] w-28 flex-shrink-0 pt-0.5">{label}</span>
            {badge ? (
              <Badge variant="outline" className="text-[10px] font-data px-1.5 py-0 h-[18px] no-default-hover-elevate no-default-active-elevate" style={{ borderColor: `${color}40`, color }}>
                {value}
              </Badge>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] text-[var(--text-primary)] font-data truncate">{value}</span>
                {copyable && (
                  <button
                    onClick={() => navigator.clipboard.writeText(copyable)}
                    className="text-[var(--text-disabled)] hover:text-[var(--text-secondary)] flex-shrink-0"
                    data-testid="btn-copy-hash"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {metadata.vision_analysis && (
        <div className="mt-4 p-3 rounded-lg bg-[#8B5CF6]/5 border border-[#8B5CF6]/20">
          <div className="flex items-center gap-1.5 mb-2">
            <Eye className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span className="text-[11px] font-medium text-[#8B5CF6]">AI Vision Analysis</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {metadata.vision_analysis.description || "No description available."}
          </p>
          {metadata.vision_analysis.extracted_text && (
            <div className="mt-2 pt-2 border-t border-[#8B5CF6]/20">
              <span className="text-[10px] text-[var(--text-disabled)]">Extracted Text:</span>
              <p className="font-data text-[10px] text-[var(--text-secondary)] mt-1 whitespace-pre-wrap line-clamp-6">
                {metadata.vision_analysis.extracted_text}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExtractedTextTab({ text }: { text: string | null }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  if (!text) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <FileText className="w-8 h-8 text-[var(--theme-border)] mx-auto mb-2" />
          <p className="text-xs text-[var(--text-disabled)]">No text was extracted from this document.</p>
        </div>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = text.split("\n");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--theme-border)]/30 bg-[var(--bg-panel)]">
        <div className="flex items-center gap-1 flex-1 bg-[var(--bg-primary)] rounded px-2 py-1 border border-[var(--theme-border)]/30">
          <Search className="w-3 h-3 text-[var(--text-disabled)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search extracted text..."
            className="bg-transparent text-[10px] text-[var(--text-primary)] placeholder-[var(--text-disabled)] outline-none w-full font-data"
            data-testid="input-extracted-search"
          />
        </div>
        <button onClick={handleCopy} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[var(--text-secondary)] hover:bg-[var(--theme-border)]/30" data-testid="btn-copy-all">
          {copied ? <CheckCircle2 className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy All"}
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-[var(--bg-panel)] p-3">
        <pre className="font-data text-[11px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
          {lines.map((line, i) => {
            const isMatch = searchQuery && line.toLowerCase().includes(searchQuery.toLowerCase());
            return (
              <div key={i} className={`flex ${isMatch ? "bg-[#F59E0B]/10" : ""}`}>
                <span className="text-[var(--text-disabled)] select-none w-10 text-right pr-3 flex-shrink-0">{i + 1}</span>
                <span className="flex-1">{line || " "}</span>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

function FindingsTab({ findings, onNavigateToFinding }: {
  findings: DetailedMetadata["findings"];
  onNavigateToFinding?: (findingId: string) => void;
}) {
  if (findings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-[var(--theme-border)] mx-auto mb-2" />
          <p className="text-xs text-[var(--text-disabled)]">No findings linked to this document.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-2">
      {findings.map((finding) => {
        const sevColor = SEVERITY_COLORS[finding.severity] || "#6B7280";
        return (
          <div
            key={finding.id}
            className="bg-[var(--bg-panel)] rounded-lg p-3 border border-[var(--theme-border)]/30"
            data-testid={`finding-card-${finding.id}`}
          >
            <div className="flex items-start gap-2 mb-1.5">
              <Badge
                variant="outline"
                className="text-[9px] font-data capitalize px-1.5 py-0 h-[16px] flex-shrink-0 no-default-hover-elevate no-default-active-elevate"
                style={{ borderColor: `${sevColor}40`, color: sevColor }}
              >
                {finding.severity}
              </Badge>
              <h4 className="text-[11px] font-medium text-[var(--text-primary)] flex-1 line-clamp-2">{finding.title}</h4>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed line-clamp-3 mb-2">{finding.description}</p>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[9px] font-data capitalize px-1.5 py-0 h-[14px] border-[var(--theme-border)] text-[var(--text-disabled)] no-default-hover-elevate no-default-active-elevate"
              >
                {finding.status}
              </Badge>
              {finding.source_document_id && (
                <span className="text-[9px] text-[#8B5CF6] italic">Auto-detected from analysis</span>
              )}
              {onNavigateToFinding && (
                <button
                  onClick={() => onNavigateToFinding(finding.id)}
                  className="ml-auto text-[9px] text-[#3B82F6] hover:underline flex items-center gap-0.5"
                  data-testid={`btn-view-finding-${finding.id}`}
                >
                  View in Risk Engine <ExternalLink className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ImageLightbox({
  documentId,
  onClose,
  dealDocuments,
  findings,
}: {
  documentId: string;
  onClose: () => void;
  dealDocuments?: Array<{ id: string; filename: string }>;
  findings?: Array<{ severity: string; title: string }>;
}) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showFindings, setShowFindings] = useState(false);
  const [currentId, setCurrentId] = useState(documentId);
  const dragStart = useRef({ x: 0, y: 0 });

  const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "tiff", "svg"]);
  const imageDocuments = useMemo(() =>
    (dealDocuments || []).filter((d) => {
      const ext = d.filename.split(".").pop()?.toLowerCase() || "";
      return imageExtensions.has(ext);
    }), [dealDocuments]);

  const currentIndex = imageDocuments.findIndex((d) => d.id === currentId);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        setCurrentId(imageDocuments[currentIndex - 1].id);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
      }
      if (e.key === "ArrowRight" && currentIndex < imageDocuments.length - 1) {
        setCurrentId(imageDocuments[currentIndex + 1].id);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, imageDocuments, onClose]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.25, Math.min(8, z + (e.deltaY > 0 ? -0.15 : 0.15))));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  }, [zoom, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }, [isDragging]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" data-testid="lightbox-overlay">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} className="p-1.5 rounded-md hover:bg-white/10 text-white/70">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-data text-xs text-white/60">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(8, z + 0.25))} className="p-1.5 rounded-md hover:bg-white/10 text-white/70">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }} className="px-2 py-1 rounded-md text-xs text-white/60 hover:bg-white/10">
            Reset
          </button>
        </div>
        <div className="flex items-center gap-3">
          {findings && findings.length > 0 && (
            <button
              onClick={() => setShowFindings(!showFindings)}
              className={`px-2.5 py-1 rounded-md text-xs ${showFindings ? "bg-[#F59E0B]/20 text-[#F59E0B]" : "text-white/60 hover:bg-white/10"}`}
              data-testid="btn-toggle-findings"
            >
              Show AI Findings ({findings.length})
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/10 text-white/70" data-testid="btn-close-lightbox">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        style={{ cursor: isDragging ? "grabbing" : zoom > 1 ? "grab" : "default" }}
      >
        {showFindings && findings && (
          <div className="absolute top-3 left-3 z-10 space-y-1 max-w-xs" data-testid="lightbox-findings">
            {findings.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-md px-2.5 py-1.5">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: SEVERITY_COLORS[f.severity] || "#F59E0B" }} />
                <span className="text-[10px] text-white/90 font-medium uppercase" style={{ color: SEVERITY_COLORS[f.severity] }}>{f.severity}:</span>
                <span className="text-[10px] text-white/80 truncate">{f.title}</span>
              </div>
            ))}
          </div>
        )}

        {currentIndex > 0 && (
          <button
            onClick={() => { setCurrentId(imageDocuments[currentIndex - 1].id); setZoom(1); setPosition({ x: 0, y: 0 }); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white/70"
            data-testid="btn-prev-image"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {currentIndex < imageDocuments.length - 1 && (
          <button
            onClick={() => { setCurrentId(imageDocuments[currentIndex + 1].id); setZoom(1); setPosition({ x: 0, y: 0 }); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white/70"
            data-testid="btn-next-image"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <img
          src={`/api/documents/${currentId}/preview?size=full`}
          alt="Fullscreen preview"
          className="max-w-[90vw] max-h-[85vh] object-contain select-none"
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            transition: isDragging ? "none" : "transform 0.15s ease",
          }}
          draggable={false}
          data-testid="img-lightbox"
        />
      </div>

      {imageDocuments.length > 1 && (
        <div className="text-center py-2">
          <span className="font-data text-xs text-white/50">
            Image {currentIndex + 1} of {imageDocuments.length}
          </span>
        </div>
      )}
    </div>
  );
}

type PreviewTab = "preview" | "details" | "extracted" | "findings";

export default function DocumentPreview({ documentId, onClose, defaultTab, dealDocuments }: DocumentPreviewProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>((defaultTab as PreviewTab) || "preview");
  const [showLightbox, setShowLightbox] = useState(false);

  const { data: metadata, isLoading: metaLoading } = useQuery<DetailedMetadata>({
    queryKey: ["/api/documents", documentId, "metadata"],
  });

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ["/api/documents", documentId, "preview-data"],
    queryFn: async () => {
      if (!metadata) return null;
      const pt = metadata.preview_type;
      if (pt === "image" || pt === "pdf") return null;
      const res = await fetch(`/api/documents/${documentId}/preview`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!metadata && metadata.preview_type !== "image" && metadata.preview_type !== "pdf",
  });

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showLightbox) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, showLightbox]);

  const previewType = metadata?.preview_type || "unsupported";
  const clsColor = CLASSIFICATION_COLORS[metadata?.classification || "General"] || "#6B7280";
  const hasFindingsTab = (metadata?.finding_count || 0) > 0;

  const tabs: Array<{ id: PreviewTab; label: string; show: boolean }> = [
    { id: "preview", label: "Preview", show: true },
    { id: "details", label: "Details", show: true },
    { id: "extracted", label: "Extracted Text", show: true },
    { id: "findings", label: `Findings (${metadata?.finding_count || 0})`, show: hasFindingsTab },
  ];

  const renderPreviewContent = () => {
    if (previewLoading || metaLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#3B82F6] animate-spin" />
        </div>
      );
    }

    if (previewType === "image") {
      return <ImagePreview documentId={documentId} onOpenLightbox={() => setShowLightbox(true)} />;
    }
    if (previewType === "pdf") {
      return <PdfPreview documentId={documentId} />;
    }
    if (previewType === "text" && previewData) {
      return <TextPreview content={previewData.content || ""} language={previewData.language || "text"} />;
    }
    if (previewType === "html" && previewData) {
      return <HtmlPreview html={previewData.html || ""} />;
    }
    if (previewType === "spreadsheet" && previewData) {
      return <SpreadsheetPreview html={previewData.html || ""} sheets={previewData.sheets || []} />;
    }
    if (previewType === "slides" && previewData) {
      return <SlidesPreview slides={previewData.slides || []} />;
    }
    if (previewType === "email" && previewData) {
      return <EmailPreview data={previewData} />;
    }

    if (previewType === "fallback" && previewData?.content) {
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--theme-border)]/30 bg-[var(--bg-panel)]">
            <FileText className="w-3 h-3 text-[var(--text-disabled)]" />
            <span className="text-[10px] text-[var(--text-disabled)]">
              Preview rendered from extracted text. Original format: <span className="font-data">{previewData.original_type || metadata?.file_type || "unknown"}</span>
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            <TextPreview content={previewData.content} language={previewData.language || "text"} />
          </div>
        </div>
      );
    }

    if (metadata?.extracted_text) {
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--theme-border)]/30 bg-[var(--bg-panel)]">
            <FileText className="w-3 h-3 text-[var(--text-disabled)]" />
            <span className="text-[10px] text-[var(--text-disabled)]">
              Original file preview unavailable. Showing extracted text.
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            <TextPreview content={metadata.extracted_text} language="text" />
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <File className="w-8 h-8 text-[var(--theme-border)] mx-auto mb-2" />
          <p className="text-xs text-[var(--text-disabled)]">No preview available.</p>
          <p className="text-[10px] text-[var(--text-disabled)] mt-1">This file has no extractable content to display.</p>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "preview":
        return renderPreviewContent();
      case "details":
        return metadata ? <DetailsTab metadata={metadata} /> : null;
      case "extracted":
        return <ExtractedTextTab text={metadata?.extracted_text || null} />;
      case "findings":
        return metadata ? <FindingsTab findings={metadata.findings || []} /> : null;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end" data-testid="document-preview-panel">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} data-testid="preview-backdrop" />
        <div
          className="relative w-full max-w-[60vw] min-w-[400px] bg-[var(--bg-card)] border-l border-[var(--theme-border)] flex flex-col shadow-2xl animate-slide-in-right"
          style={{ animation: "slideInRight 0.2s ease" }}
        >
          <div className="flex items-center gap-2 px-4 py-3 bg-[var(--bg-panel)] border-b border-[var(--theme-border)]">
            <button onClick={onClose} className="p-1 rounded hover:bg-[var(--theme-border)]/30" data-testid="btn-preview-back">
              <ArrowLeft className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate" title={metadata?.filename}>
                {metadata?.filename || "Loading..."}
              </p>
            </div>
            {metadata?.classification && (
              <Badge
                variant="outline"
                className="text-[9px] font-data px-1.5 py-0 h-[16px] flex-shrink-0 no-default-hover-elevate no-default-active-elevate"
                style={{ borderColor: `${clsColor}30`, color: clsColor }}
              >
                {metadata.classification}
              </Badge>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-[var(--theme-border)]/30" data-testid="btn-preview-close">
              <X className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-[var(--theme-border)]/50 bg-[var(--bg-card)]">
            {tabs.filter((t) => t.show).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded text-[11px] transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#3B82F6]/10 text-[#3B82F6] font-medium"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--theme-border)]/20"
                }`}
                data-testid={`tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {renderTabContent()}
          </div>

          {metadata && (
            <div className="px-4 py-2 border-t border-[var(--theme-border)]/50 bg-[var(--bg-panel)] flex items-center gap-3 flex-wrap">
              <span className="font-data text-[10px] text-[var(--text-disabled)]">{formatFileSize(metadata.file_size || 0)}</span>
              <span className="text-[var(--text-disabled)]">·</span>
              <span className="font-data text-[10px] text-[var(--text-disabled)]">
                {metadata.created_at ? new Date(metadata.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
              </span>
              <span className="text-[var(--text-disabled)]">·</span>
              <span className="font-data text-[10px] text-[var(--text-disabled)]">{metadata.chunk_count} chunks</span>
              {metadata.finding_count > 0 && (
                <>
                  <span className="text-[var(--text-disabled)]">·</span>
                  <span className="font-data text-[10px] text-[#F59E0B]">{metadata.finding_count} findings</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showLightbox && metadata && (
        <ImageLightbox
          documentId={documentId}
          onClose={() => setShowLightbox(false)}
          dealDocuments={dealDocuments}
          findings={metadata.findings?.map((f) => ({ severity: f.severity, title: f.title }))}
        />
      )}
    </>
  );
}
