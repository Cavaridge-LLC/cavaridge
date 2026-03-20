/**
 * Ticket Detail — view, update, comment, escalate, resolve.
 * Shows AI enrichment results and SLA tracking.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Sparkles, Clock, ChevronUp, Check, X,
} from 'lucide-react';
import { tickets, enrichment } from '../lib/api';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<any>(null);

  const load = async () => {
    if (!id) return;
    try {
      const data = await tickets.get(id);
      setTicket(data);
    } catch {
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAddComment = async () => {
    if (!comment.trim() || !id) return;
    await tickets.addComment(id, { body: comment, isInternal });
    setComment('');
    load();
  };

  const handleEnrich = async () => {
    if (!id) return;
    setEnriching(true);
    try {
      const result = await enrichment.enrichTicket(id);
      setEnrichResult(result.enrichment);
      load();
    } finally {
      setEnriching(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    if (status === 'resolved') {
      await tickets.resolve(id);
    } else if (status === 'closed') {
      await tickets.close(id);
    } else {
      await tickets.update(id, { status });
    }
    load();
  };

  const handleEscalate = async () => {
    if (!id) return;
    const reason = prompt('Escalation reason:');
    if (!reason) return;
    await tickets.escalate(id, { reason });
    load();
  };

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;
  if (!ticket) return <div className="p-6 text-gray-400">Ticket not found.</div>;

  const priorityColors: Record<string, string> = {
    critical: 'text-red-600 bg-red-50 dark:bg-red-950',
    high: 'text-orange-600 bg-orange-50 dark:bg-orange-950',
    medium: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950',
    low: 'text-green-600 bg-green-50 dark:bg-green-950',
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/tickets')} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-gray-500">{ticket.ticket_number}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[ticket.priority] ?? ''}`}>
              {ticket.priority}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800">
              {ticket.status}
            </span>
          </div>
          <h2 className="text-xl font-bold mt-1">{ticket.subject}</h2>
        </div>
      </div>

      {/* SLA indicators */}
      {ticket.sla_response_due && (
        <div className="flex gap-4 text-sm">
          <SlaIndicator
            label="Response"
            due={ticket.sla_response_due}
            met={ticket.sla_responded_at}
            breached={ticket.sla_response_breached}
          />
          <SlaIndicator
            label="Resolution"
            due={ticket.sla_resolution_due}
            met={ticket.sla_resolved_at}
            breached={ticket.sla_resolution_breached}
          />
        </div>
      )}

      {/* Description */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
        <p className="text-sm whitespace-pre-wrap">{ticket.description ?? 'No description provided.'}</p>
      </div>

      {/* AI Enrichment */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <Sparkles size={14} className="text-purple-500" /> AI Enrichment
          </h3>
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="text-xs px-3 py-1 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900 disabled:opacity-50"
          >
            {enriching ? 'Analyzing...' : 'Enrich with AI'}
          </button>
        </div>

        {(ticket.ai_suggested_resolution || enrichResult) && (
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-gray-500">Category:</span>
              <span>{ticket.category ?? enrichResult?.category ?? '—'}</span>
              {ticket.ai_category_confidence && (
                <span className="text-xs text-gray-400">({Math.round(ticket.ai_category_confidence * 100)}% confidence)</span>
              )}
            </div>
            {ticket.ai_suggested_resolution && (
              <div>
                <span className="text-gray-500">Suggested Resolution:</span>
                <p className="mt-1 text-sm bg-purple-50 dark:bg-purple-950 p-3 rounded">
                  {ticket.ai_suggested_resolution}
                </p>
              </div>
            )}
          </div>
        )}

        {!ticket.ai_suggested_resolution && !enrichResult && (
          <p className="text-xs text-gray-400">Click "Enrich with AI" to auto-categorize and get resolution suggestions.</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
          <>
            <button onClick={() => handleStatusChange('resolved')}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100">
              <Check size={14} /> Resolve
            </button>
            <button onClick={handleEscalate}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-100">
              <ChevronUp size={14} /> Escalate
            </button>
          </>
        )}
        {ticket.status === 'resolved' && (
          <button onClick={() => handleStatusChange('closed')}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200">
            <X size={14} /> Close
          </button>
        )}
      </div>

      {/* Comments */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
          <MessageSquare size={14} /> Comments ({ticket.comments?.length ?? 0})
        </h3>

        <div className="space-y-4 mb-4">
          {(ticket.comments ?? []).map((c: any) => (
            <div key={c.id} className={`text-sm p-3 rounded-lg ${
              c.is_internal
                ? 'bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800'
                : 'bg-gray-50 dark:bg-gray-900'
            }`}>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <span className="font-medium">{c.author_id?.slice(0, 8)}</span>
                {c.is_internal && <span className="text-yellow-600 font-medium">INTERNAL</span>}
                {c.is_resolution && <span className="text-green-600 font-medium">RESOLUTION</span>}
                <span>{new Date(c.created_at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>

        {/* Add comment */}
        <div className="space-y-2">
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment..."
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-500">
              <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
              Internal note
            </label>
            <button
              onClick={handleAddComment}
              disabled={!comment.trim()}
              className="px-4 py-1.5 text-sm bg-[#2E5090] text-white rounded-lg hover:bg-[#254078] disabled:opacity-50"
            >
              Add Comment
            </button>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 text-sm border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <div><span className="text-gray-500">Source:</span> {ticket.source}</div>
        <div><span className="text-gray-500">Assigned To:</span> {ticket.assigned_to?.slice(0, 8) ?? 'Unassigned'}</div>
        <div><span className="text-gray-500">Category:</span> {ticket.category ?? '—'}</div>
        <div><span className="text-gray-500">Created:</span> {new Date(ticket.created_at).toLocaleString()}</div>
        {ticket.connector_source && (
          <div><span className="text-gray-500">Connector:</span> {ticket.connector_source}</div>
        )}
      </div>
    </div>
  );
}

function SlaIndicator({ label, due, met, breached }: {
  label: string;
  due: string;
  met?: string;
  breached: boolean;
}) {
  const isBreached = breached || (!met && new Date(due) < new Date());
  const isWarning = !isBreached && !met && new Date(due) < new Date(Date.now() + 30 * 60000);
  const isMet = !!met;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
      isBreached ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
        : isWarning ? 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300'
        : isMet ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
        : 'bg-gray-50 dark:bg-gray-900 text-gray-500'
    }`}>
      <Clock size={12} />
      {label}: {isBreached ? 'BREACHED' : isMet ? 'Met' : isWarning ? 'Warning' : new Date(due).toLocaleString()}
    </div>
  );
}
