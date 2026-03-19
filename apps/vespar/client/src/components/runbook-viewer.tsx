import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useRunbooks,
  useRunbook,
  useGenerateRunbook,
  useUpdateRunbook,
} from "@/lib/api";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#EAB30833", text: "#EAB308" },
  reviewed: { bg: "#3B82F633", text: "#3B82F6" },
  approved: { bg: "#22C55E33", text: "#22C55E" },
};

interface RunbookViewerProps {
  projectId: string;
}

export default function RunbookViewer({ projectId }: RunbookViewerProps) {
  const { data: runbooks = [], isLoading } = useRunbooks(projectId);
  const generateRunbook = useGenerateRunbook(projectId);
  const updateRunbook = useUpdateRunbook(projectId);

  const [selectedId, setSelectedId] = useState<string>("");
  const { data: selectedRunbook, isLoading: runbookLoading } = useRunbook(
    selectedId
  );

  if (isLoading) {
    return (
      <div style={{ padding: 32, color: "var(--text-secondary)" }}>
        Loading runbooks...
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        border: "1px solid var(--border-primary)",
        borderRadius: 8,
        overflow: "hidden",
        minHeight: 480,
        background: "var(--bg-primary)",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 260,
          minWidth: 260,
          borderRight: "1px solid var(--border-primary)",
          background: "var(--bg-secondary)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid var(--border-primary)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Runbooks
          </span>
          <button
            onClick={() => generateRunbook.mutate()}
            disabled={generateRunbook.isPending}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              background: "var(--accent-blue)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 500,
              opacity: generateRunbook.isPending ? 0.6 : 1,
            }}
          >
            {generateRunbook.isPending ? "Generating..." : "Generate Runbook"}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {runbooks.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--text-disabled)",
                fontSize: 13,
              }}
            >
              No runbooks yet. Generate one to get started.
            </div>
          ) : (
            runbooks.map((rb) => {
              const isActive = rb.id === selectedId;
              const statusStyle = STATUS_COLORS[rb.status] || STATUS_COLORS.draft;
              return (
                <div
                  key={rb.id}
                  onClick={() => setSelectedId(rb.id)}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border-primary)",
                    background: isActive
                      ? "var(--bg-tertiary)"
                      : "transparent",
                    transition: "background 0.1s",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      marginBottom: 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {rb.title}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        padding: "1px 6px",
                        borderRadius: 9999,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "capitalize",
                        background: statusStyle.bg,
                        color: statusStyle.text,
                      }}
                    >
                      {rb.status}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-disabled)",
                      }}
                    >
                      v{rb.version}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {!selectedId ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-disabled)",
              fontSize: 14,
            }}
          >
            {runbooks.length === 0
              ? "No runbooks yet. Generate one to get started."
              : "Select a runbook from the sidebar to view it."}
          </div>
        ) : runbookLoading ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              fontSize: 13,
            }}
          >
            Loading runbook...
          </div>
        ) : selectedRunbook ? (
          <>
            {/* Header bar */}
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid var(--border-primary)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--bg-secondary)",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {selectedRunbook.title}
                </span>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    color: "var(--text-disabled)",
                  }}
                >
                  v{selectedRunbook.version}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {selectedRunbook.status === "draft" && (
                  <button
                    onClick={() =>
                      updateRunbook.mutate({
                        id: selectedRunbook.id,
                        status: "reviewed",
                      })
                    }
                    disabled={updateRunbook.isPending}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 4,
                      background: "#3B82F6",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    Mark Reviewed
                  </button>
                )}
                {selectedRunbook.status === "reviewed" && (
                  <button
                    onClick={() =>
                      updateRunbook.mutate({
                        id: selectedRunbook.id,
                        status: "approved",
                      })
                    }
                    disabled={updateRunbook.isPending}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 4,
                      background: "#22C55E",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    Approve
                  </button>
                )}
              </div>
            </div>

            {/* Markdown content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 24px",
              }}
            >
              {selectedRunbook.content ? (
                <div
                  className="runbook-content"
                  style={{
                    color: "var(--text-primary)",
                    fontSize: 14,
                    lineHeight: 1.7,
                  }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedRunbook.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div
                  style={{
                    color: "var(--text-disabled)",
                    fontSize: 13,
                    padding: 24,
                    textAlign: "center",
                  }}
                >
                  This runbook has no content yet.
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
