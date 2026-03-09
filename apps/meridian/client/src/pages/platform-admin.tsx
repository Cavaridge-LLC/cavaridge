import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2, Users, FileText, MessageSquare, Database,
  CheckCircle2, XCircle, Clock, Plus, ArrowRight,
  Shield, AlertTriangle, Flame, Globe, Settings2, Trash2, Loader2
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function KPIStrip() {
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/platform/stats"],
  });

  const kpis = [
    { label: "Organizations", value: stats?.totalOrgs ?? "--", sub: `${stats?.activeOrgs ?? 0} active`, icon: Building2, color: "text-blue-400" },
    { label: "Total Users", value: stats?.totalUsers ?? "--", icon: Users, color: "text-emerald-400" },
    { label: "Total Deals", value: stats?.totalDeals ?? "--", icon: Database, color: "text-amber-400" },
    { label: "Documents", value: stats?.totalDocuments ?? "--", icon: FileText, color: "text-purple-400" },
    { label: "AI Queries", value: stats?.monthlyQueries ?? "--", sub: "this month", icon: MessageSquare, color: "text-cyan-400" },
  ];

  return (
    <div className="grid grid-cols-5 gap-3 mb-6">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="p-4 border-[var(--theme-border)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 mb-2">
            <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            <span className="text-xs text-[var(--text-disabled)]">{kpi.label}</span>
          </div>
          <div className="text-2xl font-data font-semibold text-[var(--text-primary)]" data-testid={`kpi-${kpi.label.toLowerCase().replace(/\s+/g, "-")}`}>
            {kpi.value}
          </div>
          {kpi.sub && <span className="text-[10px] text-[var(--text-disabled)]">{kpi.sub}</span>}
        </Card>
      ))}
    </div>
  );
}

function OrganizationsTab() {
  const { switchOrg, user } = useAuth();
  const { toast } = useToast();
  const isPlatformOwner = user?.role === "platform_owner";
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [editOrgOpen, setEditOrgOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<any>(null);
  const [newOrg, setNewOrg] = useState({ name: "", slug: "", planTier: "starter", ownerEmail: "", ownerName: "", industry: "" });

  const { data: orgs = [] } = useQuery<any[]>({
    queryKey: ["/api/platform/organizations"],
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/platform/organizations", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Organization created", description: data.inviteLink ? "Invitation link generated" : "Organization ready" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/stats"] });
      setCreateOrgOpen(false);
      setNewOrg({ name: "", slug: "", planTier: "starter", ownerEmail: "", ownerName: "", industry: "" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create organization", description: err.message, variant: "destructive" });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/platform/organizations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Organization updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/organizations"] });
      setEditOrgOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/platform/organizations/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Organization deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/stats"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  const [deleteConfirmOrg, setDeleteConfirmOrg] = useState<any>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const handleSwitchToOrg = async (orgId: string) => {
    await switchOrg(orgId);
    window.location.href = "/";
  };

  const tierColors: Record<string, string> = {
    starter: "border-[var(--theme-border)] text-[var(--text-disabled)]",
    professional: "border-blue-500/40 text-blue-400",
    enterprise: "border-amber-500/40 text-amber-400",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[var(--text-primary)] font-semibold">Organizations</h3>
          <Badge variant="outline" className="text-[10px] border-[var(--theme-border)] text-[var(--text-disabled)] no-default-hover-elevate no-default-active-elevate">{orgs.length}</Badge>
        </div>
        <Button data-testid="button-create-org" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setCreateOrgOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Create Organization
        </Button>
      </div>

      <div className="space-y-2">
        {orgs.map((org: any) => (
          <Card key={org.id} className="p-4 border-[var(--theme-border)] bg-[var(--bg-card)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded bg-[var(--bg-panel)] border border-[var(--theme-border)] flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-[var(--text-disabled)]" />
                </div>
                <div className="min-w-0">
                  <button
                    className="text-sm font-medium text-[var(--text-primary)] hover:text-blue-400 transition-colors cursor-pointer"
                    onClick={() => handleSwitchToOrg(org.id)}
                    data-testid={`org-name-${org.slug}`}
                  >
                    {org.name}
                  </button>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-data text-[var(--text-disabled)]">{org.slug}</span>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 no-default-hover-elevate no-default-active-elevate ${tierColors[org.planTier] || tierColors.starter}`}>
                      {org.planTier}
                    </Badge>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 no-default-hover-elevate no-default-active-elevate ${org.isActive ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}`}>
                      {org.isActive ? "Active" : "Suspended"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-[var(--text-disabled)] font-data">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{org.userCount ?? 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  <span>{org.dealCount ?? 0}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs border-[var(--theme-border)] text-[var(--text-secondary)]" data-testid={`org-actions-${org.slug}`}>
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-[var(--theme-border)]" style={{ background: "var(--bg-card)" }}>
                    <DropdownMenuItem className="text-[var(--text-secondary)] cursor-pointer" onClick={() => handleSwitchToOrg(org.id)}>
                      <ArrowRight className="w-4 h-4 mr-2" /> Switch to Org
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-[var(--text-secondary)] cursor-pointer" onClick={() => { setEditOrg(org); setEditOrgOpen(true); }}>
                      <Settings2 className="w-4 h-4 mr-2" /> Edit Organization
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-[var(--text-secondary)] cursor-pointer" onClick={() => updateOrgMutation.mutate({ id: org.id, isActive: !org.isActive })}>
                      {org.isActive ? <XCircle className="w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      {org.isActive ? "Suspend" : "Activate"}
                    </DropdownMenuItem>
                    {isPlatformOwner && org.slug !== "cavaridge" && (
                      <DropdownMenuItem className="text-red-400 cursor-pointer" onClick={() => { setDeleteConfirmOrg(org); setDeleteConfirmText(""); }}>
                        <Flame className="w-4 h-4 mr-2" /> Delete Organization
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={createOrgOpen} onOpenChange={setCreateOrgOpen}>
        <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Create Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-[var(--text-secondary)] text-sm">Name</Label>
              <Input value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/,"") })} placeholder="Acme Capital" className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)]" data-testid="input-new-org-name" />
            </div>
            <div className="space-y-1">
              <Label className="text-[var(--text-secondary)] text-sm">Slug</Label>
              <Input value={newOrg.slug} onChange={(e) => setNewOrg({ ...newOrg, slug: e.target.value })} className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)] font-data" data-testid="input-new-org-slug" />
            </div>
            <div className="space-y-1">
              <Label className="text-[var(--text-secondary)] text-sm">Plan Tier</Label>
              <Select value={newOrg.planTier} onValueChange={(v) => setNewOrg({ ...newOrg, planTier: v })}>
                <SelectTrigger className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[var(--text-secondary)] text-sm">Owner Email</Label>
              <Input value={newOrg.ownerEmail} onChange={(e) => setNewOrg({ ...newOrg, ownerEmail: e.target.value })} placeholder="owner@company.com" className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)]" data-testid="input-new-org-email" />
            </div>
            <div className="space-y-1">
              <Label className="text-[var(--text-secondary)] text-sm">Owner Name</Label>
              <Input value={newOrg.ownerName} onChange={(e) => setNewOrg({ ...newOrg, ownerName: e.target.value })} placeholder="Jane Smith" className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)]" data-testid="input-new-org-owner" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOrgOpen(false)} className="border-[var(--theme-border)] text-[var(--text-secondary)]">Cancel</Button>
            <Button className="bg-blue-600 text-white" disabled={!newOrg.name || !newOrg.ownerEmail || !newOrg.ownerName || createOrgMutation.isPending} onClick={() => createOrgMutation.mutate(newOrg)} data-testid="button-create-org-submit">
              {createOrgMutation.isPending ? "Creating..." : "Create & Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOrgOpen} onOpenChange={setEditOrgOpen}>
        <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Edit Organization</DialogTitle>
          </DialogHeader>
          {editOrg && (
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-[var(--text-secondary)] text-sm">Plan Tier</Label>
                <Select value={editOrg.planTier} onValueChange={(v) => setEditOrg({ ...editOrg, planTier: v })}>
                  <SelectTrigger className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[var(--text-secondary)] text-sm">Max Users</Label>
                <Input type="number" value={editOrg.maxUsers || ""} onChange={(e) => setEditOrg({ ...editOrg, maxUsers: parseInt(e.target.value) || 0 })} className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)] font-data" />
              </div>
              <div className="space-y-1">
                <Label className="text-[var(--text-secondary)] text-sm">Status</Label>
                <Select value={editOrg.isActive ? "active" : "suspended"} onValueChange={(v) => setEditOrg({ ...editOrg, isActive: v === "active" })}>
                  <SelectTrigger className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrgOpen(false)} className="border-[var(--theme-border)] text-[var(--text-secondary)]">Cancel</Button>
            <Button className="bg-blue-600 text-white" disabled={updateOrgMutation.isPending} onClick={() => updateOrgMutation.mutate({ id: editOrg.id, planTier: editOrg.planTier, maxUsers: editOrg.maxUsers, isActive: editOrg.isActive })}>
              {updateOrgMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmOrg} onOpenChange={(open) => { if (!open) { setDeleteConfirmOrg(null); setDeleteConfirmText(""); } }}>
        <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" /> Delete Organization
            </DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)]">
              This will permanently delete <span className="text-[var(--text-primary)] font-medium">{deleteConfirmOrg?.name}</span> and all its data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-[var(--text-secondary)] text-sm">Type the organization name to confirm</Label>
            <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder={deleteConfirmOrg?.name} className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)]" data-testid="input-delete-org-confirm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOrg(null)} className="border-[var(--theme-border)] text-[var(--text-secondary)]">Cancel</Button>
            <Button variant="destructive" disabled={deleteConfirmText !== deleteConfirmOrg?.name || deleteOrgMutation.isPending} onClick={() => { deleteOrgMutation.mutate(deleteConfirmOrg.id); setDeleteConfirmOrg(null); }} data-testid="button-delete-org-confirm">
              Delete Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountRequestsTab() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [approveRequest, setApproveRequest] = useState<any>(null);
  const [rejectRequest, setRejectRequest] = useState<any>(null);
  const [approveNotes, setApproveNotes] = useState("");
  const [approvePlanTier, setApprovePlanTier] = useState("starter");
  const [rejectReason, setRejectReason] = useState("");

  const { data: requests = [] } = useQuery<any[]>({
    queryKey: ["/api/platform/account-requests", filter === "all" ? undefined : filter],
    queryFn: async () => {
      const url = filter === "all" ? "/api/platform/account-requests" : `/api/platform/account-requests?status=${filter}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, planTier, reviewNotes }: any) => {
      const res = await apiRequest("PATCH", `/api/platform/account-requests/${id}`, { status: "approved", planTier, reviewNotes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request approved", description: "Organization created and invitation sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/account-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/stats"] });
      setApproveRequest(null);
    },
    onError: (err: any) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reviewNotes }: any) => {
      const res = await apiRequest("PATCH", `/api/platform/account-requests/${id}`, { status: "rejected", reviewNotes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/account-requests"] });
      setRejectRequest(null);
    },
    onError: (err: any) => {
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" });
    },
  });

  const statusColors: Record<string, string> = {
    pending: "border-amber-500/40 text-amber-400",
    approved: "border-emerald-500/40 text-emerald-400",
    rejected: "border-red-500/40 text-red-400",
    converted: "border-blue-500/40 text-blue-400",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[var(--text-primary)] font-semibold">Account Requests</h3>
        <div className="flex gap-1">
          {["all", "pending", "approved", "rejected"].map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" className={`h-7 text-xs ${filter === f ? "bg-blue-600 text-white" : "border-[var(--theme-border)] text-[var(--text-secondary)]"}`} onClick={() => setFilter(f)} data-testid={`filter-${f}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <Card className="p-8 border-[var(--theme-border)] bg-[var(--bg-card)] text-center">
          <p className="text-sm text-[var(--text-disabled)]">No account requests{filter !== "all" ? ` with status "${filter}"` : ""}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map((req: any) => (
            <Card key={req.id} className="p-4 border-[var(--theme-border)] bg-[var(--bg-card)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{req.companyName}</span>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 no-default-hover-elevate no-default-active-elevate ${statusColors[req.status] || ""}`}>
                      {req.status}
                    </Badge>
                    {req.industry && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-[var(--theme-border)] text-[var(--text-disabled)] no-default-hover-elevate no-default-active-elevate">
                        {req.industry}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">{req.contactName} &middot; {req.contactEmail}</div>
                  {req.message && <p className="text-xs text-[var(--text-disabled)] mt-1 line-clamp-2">{req.message}</p>}
                  <div className="text-[10px] text-[var(--text-disabled)] mt-1 font-data">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {req.status === "pending" && (
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 bg-emerald-600 text-white hover:bg-emerald-700 text-xs" onClick={() => { setApproveRequest(req); setApprovePlanTier("starter"); setApproveNotes(""); }} data-testid={`approve-${req.id}`}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10" onClick={() => { setRejectRequest(req); setRejectReason(""); }} data-testid={`reject-${req.id}`}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!approveRequest} onOpenChange={(open) => { if (!open) setApproveRequest(null); }}>
        <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Approve Request</DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)]">
              Create organization for <span className="font-medium text-[var(--text-primary)]">{approveRequest?.companyName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-[var(--text-secondary)] text-sm">Plan Tier</Label>
              <Select value={approvePlanTier} onValueChange={setApprovePlanTier}>
                <SelectTrigger className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[var(--text-secondary)] text-sm">Internal Notes</Label>
              <Textarea value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} placeholder="Optional notes..." className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveRequest(null)} className="border-[var(--theme-border)] text-[var(--text-secondary)]">Cancel</Button>
            <Button className="bg-emerald-600 text-white" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate({ id: approveRequest.id, planTier: approvePlanTier, reviewNotes: approveNotes })}>
              {approveMutation.isPending ? "Approving..." : "Approve & Create Org"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectRequest} onOpenChange={(open) => { if (!open) setRejectRequest(null); }}>
        <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Reject Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-[var(--text-secondary)] text-sm">Rejection Reason</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)]" required />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectRequest(null)} className="border-[var(--theme-border)] text-[var(--text-secondary)]">Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason || rejectMutation.isPending} onClick={() => rejectMutation.mutate({ id: rejectRequest.id, reviewNotes: rejectReason })}>
              {rejectMutation.isPending ? "Rejecting..." : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlatformUsersTab() {
  const { user } = useAuth();
  const isPlatformOwner = user?.role === "platform_owner";

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/platform/users"],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[var(--text-primary)] font-semibold">Platform Users</h3>
        {isPlatformOwner && (
          <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled>
            <Plus className="w-4 h-4 mr-1" /> Add Platform User
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {users.map((u: any) => (
          <Card key={u.id} className="p-4 border-[var(--theme-border)] bg-[var(--bg-card)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--bg-panel)] border border-[var(--theme-border)] flex items-center justify-center text-xs font-data font-semibold text-[var(--text-primary)]">
                  {u.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{u.name}</div>
                  <div className="text-xs text-[var(--text-disabled)]">{u.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 no-default-hover-elevate no-default-active-elevate ${u.role === "platform_owner" ? "border-red-500/40 text-red-400" : "border-orange-500/40 text-orange-400"}`}>
                  {u.role === "platform_owner" ? "Platform Owner" : "Platform Admin"}
                </Badge>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 no-default-hover-elevate no-default-active-elevate ${u.status === "active" ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}`}>
                  {u.status}
                </Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PlatformSettingsTab() {
  const { toast } = useToast();
  const { user, organization } = useAuth();
  const isPlatformOwner = user?.role === "platform_owner";
  const ownerOrgName = organization?.name || "the platform owner's organization";

  const { data: settings = {} } = useQuery<Record<string, any>>({
    queryKey: ["/api/platform/settings"],
  });

  const [localSettings, setLocalSettings] = useState<Record<string, any>>({});
  const [initialized, setInitialized] = useState(false);

  if (Object.keys(settings).length > 0 && !initialized) {
    setLocalSettings(settings);
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PUT", "/api/platform/settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/settings"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const [showSterilizeModal, setShowSterilizeModal] = useState(false);
  const [sterilizeConfirmText, setSterilizeConfirmText] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const sterilizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/platform/sterilize", { confirmation: "STERILIZE" });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Platform sterilized", description: "All demo data has been removed." });
      setShowSterilizeModal(false);
      setSterilizeConfirmText("");
      setPreviewData(null);
      queryClient.invalidateQueries({ queryKey: ["/api/platform/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/users"] });
    },
    onError: (err: any) => {
      toast({ title: "Sterilization failed", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenSterilizeModal = async () => {
    setShowSterilizeModal(true);
    setSterilizeConfirmText("");
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/platform/sterilize/preview");
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
      }
    } catch {}
    setLoadingPreview(false);
  };

  const previewOrgs = previewData?.tables?.find((t: any) => t.table === "organizations")?.toDelete || 0;
  const previewUsers = previewData?.tables?.find((t: any) => t.table === "users")?.toDelete || 0;
  const previewDeals = previewData?.tables?.find((t: any) => t.table === "deals")?.toDelete || 0;
  const previewDocs = previewData?.tables?.find((t: any) => t.table === "documents")?.toDelete || 0;

  return (
    <div>
      <h3 className="text-[var(--text-primary)] font-semibold mb-4">Platform Settings</h3>
      <Card className="p-6 border-[var(--theme-border)] bg-[var(--bg-card)] space-y-4">
        <div className="space-y-1">
          <Label className="text-[var(--text-secondary)] text-sm">Platform Name</Label>
          <Input value={localSettings.platform_name || ""} onChange={(e) => setLocalSettings({ ...localSettings, platform_name: e.target.value })} className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)]" disabled={!isPlatformOwner} />
        </div>
        <div className="space-y-1">
          <Label className="text-[var(--text-secondary)] text-sm">Registration Mode</Label>
          <Select value={localSettings.registration_mode || "request"} onValueChange={(v) => setLocalSettings({ ...localSettings, registration_mode: v })} disabled={!isPlatformOwner}>
            <SelectTrigger className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="request">Request Only</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[var(--text-secondary)] text-sm">Default Plan Tier</Label>
          <Select value={localSettings.default_plan_tier || "starter"} onValueChange={(v) => setLocalSettings({ ...localSettings, default_plan_tier: v })} disabled={!isPlatformOwner}>
            <SelectTrigger className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[var(--text-secondary)] text-sm">Allowed Email Domains (one per line, empty = all)</Label>
          <Textarea value={Array.isArray(localSettings.allowed_email_domains) ? localSettings.allowed_email_domains.join("\n") : ""} onChange={(e) => setLocalSettings({ ...localSettings, allowed_email_domains: e.target.value.split("\n").filter(Boolean) })} className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)] font-data text-sm" disabled={!isPlatformOwner} />
        </div>
        {isPlatformOwner && (
          <Button className="bg-blue-600 text-white" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(localSettings)} data-testid="button-save-settings">
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        )}
      </Card>

      {isPlatformOwner && (
        <div className="mt-8">
          <Card className="p-6 border-red-500/40 bg-[var(--bg-card)]">
            <h3 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Permanently remove all tenant data from the platform. This deletes all organizations (except {ownerOrgName}), all users (except platform staff), all deals, documents, and associated data.
            </p>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleOpenSterilizeModal}
              data-testid="button-sterilize-platform"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Sterilize Platform
            </Button>
          </Card>
        </div>
      )}

      <Dialog open={showSterilizeModal} onOpenChange={(open) => { if (!open) { setShowSterilizeModal(false); setSterilizeConfirmText(""); setPreviewData(null); } }}>
        <DialogContent className="border-[var(--theme-border)] bg-[var(--bg-card)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Permanently Remove All Data
            </DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)]">
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {loadingPreview ? (
              <div className="flex items-center gap-2 text-sm text-[var(--text-disabled)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading preview...
              </div>
            ) : previewData ? (
              <div className="text-sm text-[var(--text-secondary)] space-y-1">
                <p className="font-medium text-[var(--text-primary)] mb-2">This will delete:</p>
                <p>&bull; {previewOrgs} organization{previewOrgs !== 1 ? "s" : ""}</p>
                <p>&bull; {previewUsers} user{previewUsers !== 1 ? "s" : ""}</p>
                <p>&bull; {previewDeals} deal{previewDeals !== 1 ? "s" : ""}</p>
                <p>&bull; {previewDocs} document{previewDocs !== 1 ? "s" : ""}</p>
                {previewData.total_to_delete === 0 && (
                  <p className="text-green-400 mt-2 font-medium">Platform is already clean. Nothing to sterilize.</p>
                )}
              </div>
            ) : null}
            <div className="space-y-1 pt-2">
              <Label className="text-[var(--text-secondary)] text-sm">Type <span className="font-data font-bold text-red-400">STERILIZE</span> to confirm</Label>
              <Input
                value={sterilizeConfirmText}
                onChange={(e) => setSterilizeConfirmText(e.target.value)}
                placeholder="STERILIZE"
                className="border-[var(--theme-border)] text-[var(--text-primary)] bg-[var(--bg-panel)] font-data"
                data-testid="input-sterilize-confirm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowSterilizeModal(false); setSterilizeConfirmText(""); setPreviewData(null); }} className="border-[var(--theme-border)] text-[var(--text-secondary)]" data-testid="button-sterilize-cancel">
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={sterilizeConfirmText !== "STERILIZE" || sterilizeMutation.isPending}
              onClick={() => sterilizeMutation.mutate()}
              data-testid="button-sterilize-confirm"
            >
              {sterilizeMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sterilizing...</>
              ) : (
                "Sterilize Platform"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PlatformAdminPage() {
  const [activeTab, setActiveTab] = useState<"organizations" | "requests" | "users" | "settings">("organizations");
  const { user } = useAuth();

  if (!user?.isPlatformUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--text-disabled)]">Access restricted to platform administrators.</p>
      </div>
    );
  }

  const tabs = [
    { id: "organizations" as const, label: "Organizations", icon: Building2 },
    { id: "requests" as const, label: "Account Requests", icon: Globe },
    { id: "users" as const, label: "Platform Users", icon: Shield },
    { id: "settings" as const, label: "Platform Settings", icon: Settings2 },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Platform Administration</h1>
          <p className="text-xs text-[var(--text-disabled)]">Manage organizations, users, and platform settings</p>
        </div>
      </div>

      <KPIStrip />

      <div className="flex gap-1 mb-6 border-b border-[var(--theme-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`platform-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-[var(--text-disabled)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "organizations" && <OrganizationsTab />}
      {activeTab === "requests" && <AccountRequestsTab />}
      {activeTab === "users" && <PlatformUsersTab />}
      {activeTab === "settings" && <PlatformSettingsTab />}
    </div>
  );
}
