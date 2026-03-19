import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShieldCheck, Plus, Trash2, CheckCircle2, X } from "lucide-react";
import { scoringCatalogQuery, clientOverridesQuery, useSetOverride, useDeleteOverride } from "@/lib/api";
import type { CatalogEntry, ScoringOverride } from "@shared/schema";

interface Props {
  clientId: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  identity_mfa: "Identity/MFA",
  identity_access: "Identity/Access",
  email_protection: "Email Protection",
  endpoint_protection: "Endpoint Protection",
  data_protection: "Data Protection",
  backup_recovery: "Backup/Recovery",
  device_management: "Device Management",
  network_security: "Network Security",
  application_security: "Application Security",
  logging_monitoring: "Logging/Monitoring",
};

export default function Controls({ clientId }: Props) {
  const { data: catalog = [] } = useQuery(scoringCatalogQuery());
  const { data: overrides = [] } = useQuery(clientOverridesQuery(clientId));
  const setOverride = useSetOverride();
  const deleteOverride = useDeleteOverride();
  const [showDialog, setShowDialog] = useState(false);
  const [editOverride, setEditOverride] = useState({
    nativeControlId: "",
    overrideType: "manual_add" as string,
    thirdPartyProduct: "",
    compensationLevel: "full" as string,
    notes: "",
  });

  const overrideMap = new Map(
    overrides.map((o: ScoringOverride) => [o.nativeControlId, o]),
  );

  const groupedCatalog = catalog.reduce((acc: Record<string, CatalogEntry[]>, entry: CatalogEntry) => {
    const cat = entry.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(entry);
    return acc;
  }, {});

  const handleSave = () => {
    if (!editOverride.notes.trim()) return;
    setOverride.mutate(
      { clientId, ...editOverride },
      { onSuccess: () => setShowDialog(false) },
    );
  };

  const handleDelete = (controlId: string) => {
    deleteOverride.mutate({ clientId, controlId });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compensating Controls</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage third-party security tool mappings</p>
        </div>
        <Button
          onClick={() => {
            setEditOverride({ nativeControlId: "", overrideType: "manual_add", thirdPartyProduct: "", compensationLevel: "full", notes: "" });
            setShowDialog(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Override
        </Button>
      </div>

      {/* Client Overrides */}
      {overrides.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4">Active Overrides ({overrides.length})</h3>
          <div className="space-y-2">
            {overrides.map((o: ScoringOverride) => {
              const isExpired = o.expiresAt && new Date(o.expiresAt) < new Date();
              return (
                <div key={o.id} className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${isExpired ? "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20" : "border-border"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{o.nativeControlId}</span>
                      <Badge variant="outline" className="text-[10px]">{o.overrideType.replace("_", " ")}</Badge>
                      <Badge variant="outline" className="text-[10px]">{o.compensationLevel}</Badge>
                      {o.thirdPartyProduct && (
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-none">
                          {o.thirdPartyProduct}
                        </Badge>
                      )}
                      {isExpired && <Badge variant="destructive" className="text-[10px]">Expired</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{o.notes}</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleDelete(o.nativeControlId)}>
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Catalog by Category */}
      {Object.entries(groupedCatalog).map(([category, entries]) => (
        <Card key={category} className="p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            {CATEGORY_LABELS[category] ?? category}
            <Badge variant="outline" className="text-[10px] ml-2">{(entries as CatalogEntry[]).length}</Badge>
          </h3>
          <div className="space-y-3">
            {(entries as CatalogEntry[]).map((entry) => {
              const override = overrideMap.get(entry.nativeControlId);
              const products = (entry.thirdPartyProducts as Array<{ productName: string; vendorName: string }>) ?? [];
              return (
                <div key={entry.id} className="rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{entry.nativeControlName}</span>
                      <Badge variant="outline" className="text-[10px]">{entry.compensationLevel}</Badge>
                      {override && (
                        <Badge className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-none gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Override active
                        </Badge>
                      )}
                    </div>
                    {!override && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          setEditOverride({
                            nativeControlId: entry.nativeControlId,
                            overrideType: "manual_add",
                            thirdPartyProduct: products[0]?.productName ?? "",
                            compensationLevel: entry.compensationLevel,
                            notes: "",
                          });
                          setShowDialog(true);
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Override
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {products.map((p) => (
                      <Badge key={p.productName} variant="outline" className="text-[10px]">
                        {p.productName}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {/* Override Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Compensating Control Override</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Control ID</label>
              <Input value={editOverride.nativeControlId} onChange={(e) => setEditOverride({ ...editOverride, nativeControlId: e.target.value })} placeholder="e.g., ms-mfa-all-users" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Third-Party Product</label>
              <Input value={editOverride.thirdPartyProduct} onChange={(e) => setEditOverride({ ...editOverride, thirdPartyProduct: e.target.value })} placeholder="e.g., Duo Security" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Override Type</label>
                <select className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm" value={editOverride.overrideType} onChange={(e) => setEditOverride({ ...editOverride, overrideType: e.target.value })}>
                  <option value="manual_add">Manual Add</option>
                  <option value="confirm_auto">Confirm Auto-detected</option>
                  <option value="reject_auto">Reject Auto-detected</option>
                  <option value="set_partial">Set Partial</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Compensation Level</label>
                <select className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm" value={editOverride.compensationLevel} onChange={(e) => setEditOverride({ ...editOverride, compensationLevel: e.target.value })}>
                  <option value="full">Full</option>
                  <option value="partial">Partial</option>
                  <option value="none">None (reject)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes (required)</label>
              <Textarea value={editOverride.notes} onChange={(e) => setEditOverride({ ...editOverride, notes: e.target.value })} placeholder="Document why this override is being set..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!editOverride.notes.trim() || setOverride.isPending}>Save Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
