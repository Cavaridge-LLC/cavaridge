import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth, type PlanTier, isPlatformRole } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { PlanLimitModal } from "@/components/plan-limit-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Users,
  Building2,
  ScrollText,
  MoreHorizontal,
  UserPlus,
  Shield,
  Copy,
  Check,
  AlertTriangle,
  ChevronRight,
  Clock,
  ArrowRightLeft,
  Flame,
  Globe,
  Sun,
  Moon,
  Monitor,
  Crosshair,
  Plus,
  Pencil,
  Trash2,
  Star,
  Loader2,
  Server,
  Database,
  Lock,
  Network,
  Cloud,
  Cpu,
  HardDrive,
  X,
  Palette,
  Upload,
  Eye,
  RotateCcw,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { resetOnboarding } from "@cavaridge/onboarding";
import type { User, Deal, DealAccess, Organization, AuditLogEntry, BaselineProfile } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";

type SafeUser = Omit<User, "passwordHash">;

const ROLE_COLORS: Record<string, string> = {
  org_owner: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  org_admin: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  analyst: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  integration_pm: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  viewer: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  platform_owner: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  platform_admin: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

const ROLE_AVATAR_COLORS: Record<string, string> = {
  org_owner: "bg-blue-500/20 text-blue-400",
  org_admin: "bg-purple-500/20 text-purple-400",
  analyst: "bg-cyan-500/20 text-cyan-400",
  integration_pm: "bg-amber-500/20 text-amber-400",
  viewer: "bg-gray-500/20 text-gray-400",
  platform_owner: "bg-blue-500/20 text-blue-400",
  platform_admin: "bg-purple-500/20 text-purple-400",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  invited: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  disabled: "bg-red-500/15 text-red-400 border-red-500/30",
};

function roleLabel(role: string) {
  if (role === "integration_pm") return "Integration PM";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: "Logged in",
  register: "Registered account",
  deal_created: "Created deal",
  create_deal: "Created deal",
  deal_updated: "Updated deal",
  finding_added: "Added finding",
  document_uploaded: "Uploaded document",
  document_downloaded: "Downloaded document",
  user_invited: "Invited user",
  user_removed: "Removed user",
  role_changed: "Changed user role",
  user_disabled: "Disabled user",
  settings_changed: "Updated organization settings",
  chat_query: "Sent AI query",
  report_exported: "Exported report",
  ownership_transferred: "Transferred ownership",
  deal_access_updated: "Updated deal access",
  grant_deal_access: "Granted deal access",
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"team" | "organization" | "baseline" | "branding" | "audit" | "platform">("team");

  const isOwner = user?.role === "org_owner" || user?.role === "platform_owner";
  const isAdmin = user?.role === "org_admin" || user?.role === "platform_admin";
  const isPlatformOwner = user?.role === "platform_owner";
  const canManageTeam = isOwner || isAdmin;
  const canViewAudit = isOwner || isAdmin;

  const tabs: Array<{ id: "team" | "organization" | "baseline" | "branding" | "audit" | "platform"; label: string; icon: any }> = [
    { id: "team", label: "Team", icon: Users },
    { id: "organization", label: "Organization", icon: Building2 },
    { id: "baseline", label: "Baseline", icon: Crosshair },
    { id: "branding", label: "Report Branding", icon: Palette },
    { id: "audit", label: "Audit Log", icon: ScrollText },
  ];

  if (isPlatformOwner) {
    tabs.push({ id: "platform", label: "Platform", icon: Globe });
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Settings</h1>
        </div>

        <div className="flex gap-1 mb-6 border-b border-[var(--theme-border)]/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer
                border-b-2 -mb-px
                ${activeTab === tab.id
                  ? "border-[#3B82F6] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-disabled)] hover:text-[var(--text-secondary)]"
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "team" && (canManageTeam ? <TeamTab /> : <NoPermissionMessage />)}
        {activeTab === "organization" && (isOwner ? <OrganizationTab /> : <NoPermissionMessage />)}
        {activeTab === "baseline" && (isOwner ? <BaselineTab /> : <NoPermissionMessage />)}
        {activeTab === "branding" && (isOwner ? <BrandingTab /> : <NoPermissionMessage />)}
        {activeTab === "audit" && (canViewAudit ? <AuditLogTab /> : <NoPermissionMessage />)}
        {activeTab === "platform" && isPlatformOwner && <PlatformTab />}
      </div>
    </div>
  );
}

function NoPermissionMessage() {
  return (
    <Card className="p-8 bg-[var(--bg-card)] border-[var(--theme-border)]">
      <div className="flex flex-col items-center gap-3 text-center">
        <Shield className="w-10 h-10 text-[var(--text-disabled)]" />
        <p className="text-[var(--text-secondary)] text-sm">
          Contact your organization administrator to manage team settings.
        </p>
      </div>
    </Card>
  );
}

function TeamTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [dealAccessOpen, setDealAccessOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<SafeUser | null>(null);
  const [roleChangeUser, setRoleChangeUser] = useState<SafeUser | null>(null);
  const [newRole, setNewRole] = useState("");

  const { data: members = [], isLoading: membersLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/org/members"],
  });

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: invitations = [] } = useQuery<any[]>({
    queryKey: ["/api/invitations"],
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/org/members/${userId}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      toast({ title: "Role updated" });
      setRoleChangeUser(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to change role", description: err.message, variant: "destructive" });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/org/members/${userId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      toast({ title: "User status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/org/members/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      toast({ title: "User removed" });
      setConfirmRemove(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to remove user", description: err.message, variant: "destructive" });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await apiRequest("POST", "/api/org/transfer-ownership", { targetUserId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Ownership transferred" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to transfer ownership", description: err.message, variant: "destructive" });
    },
  });

  const isOwner = user?.role === "org_owner" || user?.role === "platform_owner";
  const isAdmin = user?.role === "org_admin" || user?.role === "platform_admin";

  const allowedRoles = isOwner
    ? ["org_owner", "org_admin", "analyst", "integration_pm", "viewer"]
    : ["analyst", "integration_pm", "viewer"];

  const pendingInvites = invitations.filter((i: any) => i.status === "pending");

  if (membersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Team Members</h2>
          <Badge variant="outline" className="text-xs font-data border-[var(--theme-border)] text-[var(--text-disabled)] no-default-hover-elevate no-default-active-elevate">
            {members.length}
          </Badge>
        </div>
        <Button data-testid="button-invite-user" onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1.5" />
          Invite User
        </Button>
      </div>

      <Card className="bg-[var(--bg-card)] border-[var(--theme-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-team-members">
            <thead>
              <tr className="border-b border-[var(--theme-border)]/50">
                <th className="text-left py-3 px-4 text-[var(--text-disabled)] font-medium text-xs">User</th>
                <th className="text-left py-3 px-4 text-[var(--text-disabled)] font-medium text-xs">Role</th>
                <th className="text-left py-3 px-4 text-[var(--text-disabled)] font-medium text-xs">Status</th>
                <th className="text-left py-3 px-4 text-[var(--text-disabled)] font-medium text-xs">Deals</th>
                <th className="text-left py-3 px-4 text-[var(--text-disabled)] font-medium text-xs">Last Login</th>
                <th className="text-right py-3 px-4 text-[var(--text-disabled)] font-medium text-xs w-12"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const dealCount = ["org_owner", "org_admin", "analyst", "platform_owner", "platform_admin"].includes(m.role)
                  ? "All deals"
                  : `${deals.length} assigned`;

                return (
                  <tr key={m.id} className="border-b border-[var(--theme-border)]/30 last:border-b-0" data-testid={`row-member-${m.id}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className={`text-xs font-data ${ROLE_AVATAR_COLORS[m.role] || ROLE_AVATAR_COLORS.viewer}`}>
                            {getInitials(m.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-[var(--text-primary)] font-medium">{m.name}</div>
                          <div className="text-[var(--text-disabled)] text-xs">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={`text-xs ${ROLE_COLORS[m.role] || ROLE_COLORS.viewer} no-default-hover-elevate no-default-active-elevate`}>
                        {roleLabel(m.role)}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[m.status] || STATUS_COLORS.active} no-default-hover-elevate no-default-active-elevate`}>
                        {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)] text-xs font-data">{dealCount}</td>
                    <td className="py-3 px-4 text-[var(--text-disabled)] text-xs font-data">
                      {m.lastLoginAt
                        ? new Date(m.lastLoginAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "Never"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {m.id !== user?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-member-actions-${m.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[var(--bg-card)] border-[var(--theme-border)]">
                            <DropdownMenuItem
                              data-testid={`action-change-role-${m.id}`}
                              onClick={() => { setRoleChangeUser(m); setNewRole(m.role); }}
                            >
                              Change Role
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              data-testid={`action-deal-access-${m.id}`}
                              onClick={() => { setSelectedUserId(m.id); setDealAccessOpen(true); }}
                            >
                              Manage Deal Access
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-[var(--theme-border)]/50" />
                            {m.status === "active" ? (
                              <DropdownMenuItem
                                data-testid={`action-disable-${m.id}`}
                                onClick={() => disableMutation.mutate({ userId: m.id, status: "disabled" })}
                                className="text-amber-400"
                              >
                                Disable User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                data-testid={`action-enable-${m.id}`}
                                onClick={() => disableMutation.mutate({ userId: m.id, status: "active" })}
                                className="text-emerald-400"
                              >
                                Enable User
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              data-testid={`action-remove-${m.id}`}
                              onClick={() => setConfirmRemove(m)}
                              className="text-red-400"
                            >
                              Remove User
                            </DropdownMenuItem>
                            {isOwner && m.role !== "org_owner" && m.role !== "platform_owner" && (
                              <>
                                <DropdownMenuSeparator className="bg-[var(--theme-border)]/50" />
                                <DropdownMenuItem
                                  data-testid={`action-transfer-${m.id}`}
                                  onClick={() => transferMutation.mutate(m.id)}
                                  className="text-blue-400"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                                  Transfer Ownership
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {pendingInvites.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Pending Invitations</h3>
          <Card className="bg-[var(--bg-card)] border-[var(--theme-border)] divide-y divide-[var(--theme-border)]/30">
            {pendingInvites.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between gap-4 py-3 px-4 flex-wrap" data-testid={`row-invitation-${inv.id}`}>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-primary)] text-sm">{inv.email}</span>
                  <Badge variant="outline" className={`text-xs ${ROLE_COLORS[inv.role] || ROLE_COLORS.viewer} no-default-hover-elevate no-default-active-elevate`}>
                    {roleLabel(inv.role)}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-amber-500/15 text-amber-400 border-amber-500/30 no-default-hover-elevate no-default-active-elevate">
                    Pending
                  </Badge>
                </div>
                <span className="text-[var(--text-disabled)] text-xs font-data">
                  Expires {new Date(inv.expiresAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <InviteModal open={inviteOpen} onOpenChange={setInviteOpen} allowedRoles={allowedRoles} deals={deals} />

      <RoleChangeModal
        user={roleChangeUser}
        open={!!roleChangeUser}
        onOpenChange={(open) => { if (!open) setRoleChangeUser(null); }}
        allowedRoles={allowedRoles}
        newRole={newRole}
        setNewRole={setNewRole}
        onSave={() => {
          if (roleChangeUser && newRole) changeRoleMutation.mutate({ userId: roleChangeUser.id, role: newRole });
        }}
        isPending={changeRoleMutation.isPending}
      />

      <DealAccessModal
        open={dealAccessOpen}
        onOpenChange={setDealAccessOpen}
        userId={selectedUserId}
        deals={deals}
        members={members}
      />

      <Dialog open={!!confirmRemove} onOpenChange={(open) => { if (!open) setConfirmRemove(null); }}>
        <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Remove User</DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)]">
              This will revoke {confirmRemove?.name}'s access to all deals. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => confirmRemove && removeMutation.mutate(confirmRemove.id)}
              disabled={removeMutation.isPending}
              data-testid="button-confirm-remove"
            >
              {removeMutation.isPending ? "Removing..." : "Remove User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseLimitError(err: Error): { limitType: string; current: number; limit: number; planTier: PlanTier } | null {
  try {
    const match = err.message.match(/^\d+:\s*(.*)/);
    if (!match) return null;
    const body = JSON.parse(match[1]);
    if (body.limitType) return { limitType: body.limitType, current: body.current ?? 0, limit: body.limit ?? 0, planTier: (body.planTier || "starter") as PlanTier };
  } catch {}
  return null;
}

function InviteModal({ open, onOpenChange, allowedRoles, deals }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allowedRoles: string[];
  deals: Deal[];
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("analyst");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ limitType: string; current: number; limit: number; planTier: PlanTier } | null>(null);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/invitations", { email, role });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      setInviteUrl(data.inviteUrl);
      toast({ title: "Invitation sent" });
    },
    onError: (err: any) => {
      const limit = parseLimitError(err);
      if (limit) {
        setLimitInfo(limit);
      } else {
        toast({ title: "Failed to invite", description: err.message, variant: "destructive" });
      }
    },
  });

  const handleClose = (v: boolean) => {
    if (!v) {
      setEmail("");
      setRole("analyst");
      setInviteUrl(null);
      setCopied(false);
    }
    onOpenChange(v);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">Invite User</DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            Send an invitation to join your organization.
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-md bg-[var(--bg-panel)] border border-[var(--theme-border)]">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-sm text-[var(--text-primary)]">Invitation created for {email}</span>
            </div>
            <div>
              <Label className="text-[var(--text-secondary)] text-xs mb-1 block">Invitation Link</Label>
              <div className="flex gap-2">
                <Input
                  value={inviteUrl}
                  readOnly
                  className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-xs font-data"
                  data-testid="input-invite-url"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  data-testid="button-copy-invite"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-[var(--text-secondary)] text-xs mb-1 block">Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)]"
                data-testid="input-invite-email"
              />
            </div>
            <div>
              <Label className="text-[var(--text-secondary)] text-xs mb-1 block">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)]" data-testid="select-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
                  {allowedRoles.filter(r => r !== "org_owner").map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                onClick={() => inviteMutation.mutate()}
                disabled={!email || inviteMutation.isPending}
                data-testid="button-send-invite"
              >
                {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
    {limitInfo && (
      <PlanLimitModal
        open={!!limitInfo}
        onClose={() => setLimitInfo(null)}
        limitType={limitInfo.limitType}
        current={limitInfo.current}
        limit={limitInfo.limit}
        planTier={limitInfo.planTier}
      />
    )}
    </>
  );
}

function RoleChangeModal({ user: targetUser, open, onOpenChange, allowedRoles, newRole, setNewRole, onSave, isPending }: {
  user: SafeUser | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allowedRoles: string[];
  newRole: string;
  setNewRole: (r: string) => void;
  onSave: () => void;
  isPending: boolean;
}) {
  if (!targetUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">Change Role</DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            Change the role for {targetUser.name}
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-[var(--text-secondary)] text-xs mb-1 block">New Role</Label>
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)]" data-testid="select-new-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
              {allowedRoles.map((r) => (
                <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={isPending || newRole === targetUser.role} data-testid="button-save-role">
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DealAccessModal({ open, onOpenChange, userId, deals, members }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  deals: Deal[];
  members: SafeUser[];
}) {
  const { toast } = useToast();
  const targetUser = members.find((m) => m.id === userId);
  const isFullAccess = targetUser && ["org_owner", "org_admin", "analyst", "platform_owner", "platform_admin"].includes(targetUser.role);

  const { data: currentAccess = [] } = useQuery<DealAccess[]>({
    queryKey: ["/api/org/members", userId, "deal-access"],
    queryFn: async () => {
      if (!userId) return [];
      const accessByUser = await Promise.all(
        deals.map(async (d) => {
          try {
            const res = await fetch(`/api/deals/${d.id}/access`, { credentials: "include" });
            if (!res.ok) return [];
            return res.json();
          } catch { return []; }
        })
      );
      const flat = accessByUser.flat();
      return flat.filter((a: any) => a.userId === userId);
    },
    enabled: !!userId && open,
  });

  const [localAccess, setLocalAccess] = useState<Record<string, string>>({});

  const activeDeals = deals.filter((d) => d.status !== "closed");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = activeDeals.map((d) => ({
        dealId: d.id,
        accessLevel: localAccess[d.id] || "none",
      }));
      const res = await apiRequest("PUT", `/api/org/members/${userId}/deal-access`, { dealAccess: entries });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/members", userId, "deal-access"] });
      toast({ title: "Deal access updated" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const handleOpen = (v: boolean) => {
    if (v && currentAccess.length > 0) {
      const map: Record<string, string> = {};
      for (const a of currentAccess) {
        if (a.dealId) map[a.dealId] = a.accessLevel;
      }
      setLocalAccess(map);
    } else if (v) {
      setLocalAccess({});
    }
    onOpenChange(v);
  };

  if (!targetUser) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">Manage Deal Access</DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            {targetUser.name} &mdash; {roleLabel(targetUser.role)}
          </DialogDescription>
        </DialogHeader>

        {isFullAccess ? (
          <div className="p-3 rounded-md bg-[var(--bg-panel)] border border-[var(--theme-border)] text-sm text-[var(--text-secondary)]">
            Owners, Admins, and Analysts automatically have access to all deals.
          </div>
        ) : (
          <div className="space-y-2">
            {activeDeals.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-[var(--bg-panel)] border border-[var(--theme-border)]/50 flex-wrap" data-testid={`deal-access-row-${d.id}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-primary)]">{d.targetName}</span>
                  <Badge variant="outline" className="text-[10px] border-[var(--theme-border)] text-[var(--text-disabled)] no-default-hover-elevate no-default-active-elevate">{d.industry}</Badge>
                </div>
                <Select
                  value={localAccess[d.id] || "none"}
                  onValueChange={(v) => setLocalAccess((prev) => ({ ...prev, [d.id]: v }))}
                >
                  <SelectTrigger className="w-[140px] bg-[var(--bg-card)] border-[var(--theme-border)] text-[var(--text-primary)] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
                    <SelectItem value="none">No Access</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="contributor">Contributor</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="observer">Observer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {!isFullAccess && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-deal-access">
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AppearanceCard() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--theme-border)] p-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Appearance</h3>
      <div className="flex gap-3">
        {options.map((opt) => {
          const isActive = theme === opt.value;
          return (
            <button
              key={opt.value}
              data-testid={`theme-option-${opt.value}`}
              onClick={() => setTheme(opt.value)}
              className={`flex flex-col items-center justify-center w-[100px] h-[72px] rounded-lg border transition-colors cursor-pointer ${
                isActive
                  ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6]"
                  : "border-[var(--theme-border)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <opt.icon className="w-5 h-5 mb-1.5" />
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function OrganizationTab() {
  const { toast } = useToast();

  const { data: versionData } = useQuery<{ version: string; build: number; full: string; timestamp: string; environment: string }>({
    queryKey: ["/api/version"],
    staleTime: Infinity,
  });

  const { data: orgInfo, isLoading } = useQuery<{
    organization: Organization;
    usage: {
      users: number; maxUsers: number;
      deals: number; maxDeals: number;
      storageMb: number; maxStorageMb: number;
      chatQueries: number; maxChatQueries: number;
      baselines: number; maxBaselines: number;
      storageGb: number; maxStorageGb: number;
    };
    planTier: string;
    planLimits: any;
  }>({
    queryKey: ["/api/org/info"],
  });

  const [name, setName] = useState("");
  const [industryDefault, setIndustryDefault] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3B82F6");
  const [standardRate, setStandardRate] = useState("185");
  const [seniorRate, setSeniorRate] = useState("225");
  const [emergencyRate, setEmergencyRate] = useState("285");
  const [initialized, setInitialized] = useState(false);

  if (orgInfo && !initialized) {
    setName(orgInfo.organization.name);
    setIndustryDefault(orgInfo.organization.industryDefault || "");
    setPrimaryColor(orgInfo.organization.primaryColor || "#3B82F6");
    const settings = (orgInfo.organization.settingsJson as any) || {};
    if (settings.labor_rates) {
      setStandardRate(String(settings.labor_rates.standard || 185));
      setSeniorRate(String(settings.labor_rates.senior || 225));
      setEmergencyRate(String(settings.labor_rates.emergency || 285));
    }
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const settingsJson = {
        ...((orgInfo?.organization.settingsJson as any) || {}),
        labor_rates: {
          standard: parseFloat(standardRate) || 185,
          senior: parseFloat(seniorRate) || 225,
          emergency: parseFloat(emergencyRate) || 285,
        },
      };
      const res = await apiRequest("PATCH", "/api/org/settings", {
        name,
        industryDefault: industryDefault || null,
        primaryColor,
        settingsJson,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/info"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const usage = orgInfo?.usage;
  const industries = ["Healthcare", "Financial Services", "Manufacturing", "Technology/SaaS", "Retail", "Professional Services"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <AppearanceCard />
        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Onboarding</h3>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Restart the guided tour and checklist to re-learn MERIDIAN's features.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="border-[var(--theme-border)]"
            onClick={() => {
              resetOnboarding("meridian");
              window.location.reload();
            }}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restart onboarding tour
          </Button>
        </Card>
        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Organization Settings</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-[var(--text-secondary)] text-xs mb-1 block">Organization Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)]"
                data-testid="input-org-name"
              />
            </div>
            <div>
              <Label className="text-[var(--text-secondary)] text-xs mb-1 block">Industry Default</Label>
              <Select value={industryDefault} onValueChange={setIndustryDefault}>
                <SelectTrigger className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)]" data-testid="select-industry">
                  <SelectValue placeholder="Select industry..." />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
                  {industries.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[var(--text-secondary)] text-xs mb-1 block">Primary Brand Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-9 h-9 rounded-md border border-[var(--theme-border)] bg-transparent cursor-pointer"
                  data-testid="input-brand-color"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] font-data text-xs w-28"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Default Labor Rates</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[var(--text-secondary)] text-xs mb-1 block">Standard ($/hr)</Label>
              <Input
                type="number"
                value={standardRate}
                onChange={(e) => setStandardRate(e.target.value)}
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] font-data"
                data-testid="input-rate-standard"
              />
            </div>
            <div>
              <Label className="text-[var(--text-secondary)] text-xs mb-1 block">Senior ($/hr)</Label>
              <Input
                type="number"
                value={seniorRate}
                onChange={(e) => setSeniorRate(e.target.value)}
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] font-data"
                data-testid="input-rate-senior"
              />
            </div>
            <div>
              <Label className="text-[var(--text-secondary)] text-xs mb-1 block">Emergency ($/hr)</Label>
              <Input
                type="number"
                value={emergencyRate}
                onChange={(e) => setEmergencyRate(e.target.value)}
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] font-data"
                data-testid="input-rate-emergency"
              />
            </div>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="mt-4" data-testid="button-save-org-settings">
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)] p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Plan &amp; Usage</h3>
            <Badge
              variant="outline"
              className={`text-xs no-default-hover-elevate no-default-active-elevate ${
                orgInfo?.planTier === "enterprise"
                  ? "border-amber-500/30 text-amber-400 bg-amber-500/15"
                  : orgInfo?.planTier === "professional"
                  ? "border-blue-500/30 text-blue-400 bg-blue-500/15"
                  : "border-[var(--theme-border)] text-[var(--text-disabled)] bg-[var(--bg-panel)]"
              }`}
              data-testid="badge-org-plan"
            >
              {orgInfo?.planTier ? orgInfo.planTier.charAt(0).toUpperCase() + orgInfo.planTier.slice(1) : "—"}
            </Badge>
          </div>

          {usage && (
            <div className="space-y-3">
              <PlanUsageBar label="Team Members" current={usage.users} max={usage.maxUsers} />
              <PlanUsageBar label="Active Deals" current={usage.deals} max={usage.maxDeals} />
              <PlanUsageBar label="Storage" current={usage.storageGb} max={usage.maxStorageGb} unit="GB" decimals />
              <PlanUsageBar label="AI Queries (this month)" current={usage.chatQueries} max={usage.maxChatQueries} />
              <PlanUsageBar label="Baseline Profiles" current={usage.baselines} max={usage.maxBaselines} />
            </div>
          )}
        </Card>

        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Plan Features</h3>
          <div className="space-y-2">
            <PlanFeatureRow label="Portfolio Analytics" enabled={orgInfo?.planLimits?.portfolioAnalytics} />
            <PlanFeatureRow label="Digital Twin Simulator" enabled={orgInfo?.planLimits?.digitalTwinSimulator} />
            <PlanFeatureRow label="API Access" enabled={orgInfo?.planLimits?.apiAccess} />
            <PlanFeatureRow label="White Label" enabled={orgInfo?.planLimits?.whiteLabel} />
            <PlanFeatureRow label="Priority Support" enabled={orgInfo?.planLimits?.prioritySupport} />
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="text-xs text-[var(--text-secondary)]">Audit Log Retention</span>
              <span className="text-xs font-data text-[var(--text-primary)]">
                {orgInfo?.planLimits?.auditLogRetentionDays === -1 ? "Unlimited" : `${orgInfo?.planLimits?.auditLogRetentionDays || 90} days`}
              </span>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-[var(--theme-border)]/50">
            <p className="text-xs text-[var(--text-disabled)]">
              Contact sales@meridian-platform.com to upgrade your plan.
            </p>
          </div>
        </Card>

        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)] p-5" data-testid="card-system-info">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">System Information</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Version</span>
              <span className="text-xs font-data text-[var(--text-primary)]" data-testid="text-version-settings">
                v{versionData?.version || "2.0.0"} (build {versionData?.build || 1})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Last Deployed</span>
              <span className="text-xs font-data text-[var(--text-primary)]" data-testid="text-deploy-time">
                {versionData?.timestamp
                  ? new Date(versionData.timestamp).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) +
                    " at " +
                    new Date(versionData.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Environment</span>
              <span className="text-xs font-data text-[var(--text-primary)]" data-testid="text-environment">
                {versionData?.environment === "production" ? "Production" : "Development"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Database</span>
              <div className="flex items-center gap-1.5" data-testid="text-db-status">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-data text-emerald-400">Connected</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function PlanUsageBar({ label, current, max, unit, decimals }: { label: string; current: number; max: number; unit?: string; decimals?: boolean }) {
  const isUnlimited = max === -1;
  const pct = isUnlimited ? 0 : max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-blue-500";
  const fmt = (v: number) => decimals ? v.toFixed(2) : String(v);

  return (
    <div data-testid={`usage-bar-${label.toLowerCase().replace(/[^a-z]/g, "-")}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[var(--text-secondary)] text-xs">{label}</span>
        <span className="text-[var(--text-primary)] text-xs font-data">
          {unit ? `${fmt(current)} ${unit}` : fmt(current)} / {isUnlimited ? "Unlimited" : unit ? `${fmt(max)} ${unit}` : fmt(max)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-panel)]">
        <div className={`h-full rounded-full ${isUnlimited ? "bg-emerald-500" : color} transition-all`} style={{ width: isUnlimited ? "5%" : `${pct}%` }} />
      </div>
    </div>
  );
}

function PlanFeatureRow({ label, enabled }: { label: string; enabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1" data-testid={`feature-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 h-4 no-default-hover-elevate no-default-active-elevate ${
          enabled
            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
            : "border-[var(--theme-border)] text-[var(--text-disabled)] bg-[var(--bg-panel)]"
        }`}
      >
        {enabled ? "Included" : "Not Available"}
      </Badge>
    </div>
  );
}

const TECH_CATEGORIES = [
  { id: "networking", label: "Networking", icon: Network },
  { id: "cloud", label: "Cloud / Hosting", icon: Cloud },
  { id: "servers", label: "Servers / OS", icon: Server },
  { id: "databases", label: "Databases", icon: Database },
  { id: "security", label: "Security / IAM", icon: Lock },
  { id: "storage", label: "Storage / Backup", icon: HardDrive },
  { id: "compute", label: "Compute / VDI", icon: Cpu },
  { id: "telecom", label: "Telecom / VoIP", icon: Network },
  { id: "applications", label: "Applications", icon: Server },
  { id: "email", label: "Email / Collab", icon: Globe },
  { id: "monitoring", label: "Monitoring", icon: Crosshair },
  { id: "other", label: "Other", icon: HardDrive },
];

type BaselinePriority = "required" | "recommended" | "optional";
type ProfileTechItem = { name: string; version?: string; priority?: BaselinePriority; required?: boolean };
type ProfileData = Record<string, ProfileTechItem[]>;

const PRIORITY_STYLES: Record<BaselinePriority, { dot: string; border: string; label: string; bg: string; text: string }> = {
  required: { dot: "bg-red-500", border: "border-l-red-500/40", label: "Required", bg: "bg-red-500/10", text: "text-red-400" },
  recommended: { dot: "bg-amber-500", border: "border-l-amber-500/40", label: "Recommended", bg: "bg-amber-500/10", text: "text-amber-400" },
  optional: { dot: "bg-gray-400", border: "border-l-gray-400/40", label: "Optional", bg: "bg-gray-500/10", text: "text-gray-400" },
};

function getItemPriority(item: ProfileTechItem): BaselinePriority {
  if (item.priority) return item.priority;
  if (item.required === true) return "required";
  if (item.required === false) return "optional";
  return "recommended";
}

const HEALTHCARE_TEMPLATE: ProfileData = {
  identity: [
    { name: "Entra ID with Conditional Access", priority: "required" },
    { name: "Required for all users, hardware keys for admins", priority: "required" },
    { name: "Microsoft Intune", priority: "required" },
    { name: "SAML 2.0 / OIDC for all SaaS apps", priority: "recommended" },
    { name: "CyberArk PAM or Entra PIM", priority: "optional" },
  ],
  networking: [
    { name: "Cisco Meraki Full Stack", priority: "recommended" },
    { name: "Cisco Meraki SD-WAN", priority: "optional" },
    { name: "Cisco Meraki Wireless", priority: "optional" },
    { name: "802.1X / VLAN segmentation", priority: "recommended" },
  ],
  endpoint: [
    { name: "SentinelOne or CrowdStrike Falcon", priority: "required" },
    { name: "SentinelOne Complete / CrowdStrike Falcon Insight", priority: "required" },
  ],
  security: [
    { name: "Microsoft Defender for Office 365", priority: "required" },
    { name: "Proofpoint or Mimecast", priority: "recommended" },
    { name: "Microsoft Sentinel or Splunk", priority: "recommended" },
    { name: "Tenable.io or Qualys", priority: "recommended" },
    { name: "Palo Alto or Fortinet FortiGate", priority: "recommended" },
    { name: "KnowBe4 or Proofpoint SAT", priority: "required" },
  ],
  backup: [
    { name: "Veeam Backup & Replication", priority: "required" },
    { name: "RTO: 4hrs / RPO: 1hr", priority: "required" },
    { name: "Active-Passive with 4hr RTO", priority: "recommended" },
    { name: "Quarterly DR testing", priority: "recommended" },
  ],
  collaboration: [
    { name: "Microsoft 365 E3/E5", priority: "recommended" },
    { name: "SharePoint Online / OneDrive", priority: "optional" },
    { name: "Microsoft Teams", priority: "optional" },
  ],
  compliance: [
    { name: "HIPAA, SOC 2 Type II, HITRUST", priority: "required" },
    { name: "Annual risk assessments", priority: "recommended" },
    { name: "Annual compliance audits", priority: "optional" },
  ],
};

function BaselineTab() {
  const { toast } = useToast();
  const [editingProfile, setEditingProfile] = useState<BaselineProfile | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BaselineProfile | null>(null);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);

  const { data: profiles = [], isLoading } = useQuery<BaselineProfile[]>({
    queryKey: ["/api/org/baseline-profiles"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; profileData: ProfileData; isDefault: boolean }) => {
      const res = await apiRequest("POST", "/api/org/baseline-profiles", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile created" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/baseline-profiles"] });
      setCreateOpen(false);
    },
    onError: (err: any) => toast({ title: "Failed to create", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; profileData?: ProfileData; isDefault?: boolean }) => {
      const res = await apiRequest("PUT", `/api/org/baseline-profiles/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/baseline-profiles"] });
      setEditingProfile(null);
    },
    onError: (err: any) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/org/baseline-profiles/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Profile deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/baseline-profiles"] });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast({ title: "Failed to delete", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Acquirer Baseline Profiles</h3>
          <p className="text-xs text-[var(--text-disabled)] mt-1">
            Define your organization's standard technology stack for target comparison during due diligence.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
          data-testid="button-create-baseline"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Profile
        </Button>
      </div>

      {profiles.length === 0 ? (
        <Card className="bg-[var(--bg-card)] border-[var(--theme-border)] p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Crosshair className="w-10 h-10 text-[var(--text-disabled)]" />
            <p className="text-sm text-[var(--text-secondary)]">No baseline profiles yet</p>
            <p className="text-xs text-[var(--text-disabled)] max-w-sm">
              Create a baseline profile to define your acquirer's standard technology stack.
              This will be used to compare against target company infrastructure.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => {
            const data = (profile.profileData || {}) as ProfileData;
            const totalItems = Object.values(data).reduce((sum, items) => sum + (items?.length || 0), 0);
            const categoryCount = Object.keys(data).filter(k => data[k]?.length > 0).length;
            const isExpanded = expandedProfile === profile.id;

            return (
              <Card key={profile.id} className="bg-[var(--bg-card)] border-[var(--theme-border)]" data-testid={`card-baseline-${profile.id}`}>
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedProfile(isExpanded ? null : profile.id)}
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Crosshair className="w-4.5 h-4.5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{profile.name}</span>
                      {profile.isDefault && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/30 text-amber-400 bg-amber-500/10 no-default-hover-elevate">
                          <Star className="w-2.5 h-2.5 mr-0.5" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] font-data text-[var(--text-disabled)]">{totalItems} technologies</span>
                      <span className="text-[10px] font-data text-[var(--text-disabled)]">{categoryCount} categories</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-[var(--text-disabled)] hover:text-blue-400"
                      onClick={(e) => { e.stopPropagation(); setEditingProfile(profile); }}
                      data-testid={`button-edit-baseline-${profile.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-[var(--text-disabled)] hover:text-red-400"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(profile); }}
                      data-testid={`button-delete-baseline-${profile.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <ChevronRight className={`w-4 h-4 text-[var(--text-disabled)] transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[var(--theme-border)]/50 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      {TECH_CATEGORIES.filter(cat => data[cat.id]?.length > 0).map(cat => {
                        const CatIcon = cat.icon;
                        return (
                          <div key={cat.id} className="bg-[var(--bg-panel)] rounded-lg p-3 border border-[var(--theme-border)]/50">
                            <div className="flex items-center gap-2 mb-2">
                              <CatIcon className="w-3.5 h-3.5 text-blue-400" />
                              <span className="text-xs font-medium text-[var(--text-secondary)]">{cat.label}</span>
                              <span className="text-[10px] font-data text-[var(--text-disabled)] ml-auto">{data[cat.id].length}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {data[cat.id].map((item, i) => {
                                const pri = getItemPriority(item);
                                const ps = PRIORITY_STYLES[pri];
                                return (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 h-5 no-default-hover-elevate border-[var(--theme-border)] ${ps.text} ${ps.bg}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${ps.dot} mr-1 inline-block`} />
                                    {item.name}{item.version ? ` ${item.version}` : ""}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {Object.keys(data).filter(k => data[k]?.length > 0).length === 0 && (
                        <div className="col-span-2 text-center py-6 text-[var(--text-disabled)] text-xs">
                          No technologies defined yet. Edit this profile to add your tech stack.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <BaselineProfileDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        title="Create Baseline Profile"
      />

      {editingProfile && (
        <BaselineProfileDialog
          open={!!editingProfile}
          onOpenChange={(open) => { if (!open) setEditingProfile(null); }}
          onSave={(data) => updateMutation.mutate({ id: editingProfile.id, ...data })}
          isPending={updateMutation.isPending}
          title="Edit Baseline Profile"
          initialData={editingProfile}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Delete Profile</DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)]">
              Are you sure you want to delete "{deleteTarget?.name}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-[var(--theme-border)] text-[var(--text-secondary)]">Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete-baseline"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BaselineProfileDialog({
  open, onOpenChange, onSave, isPending, title, initialData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; profileData: ProfileData; isDefault: boolean }) => void;
  isPending: boolean;
  title: string;
  initialData?: BaselineProfile;
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [isDefault, setIsDefault] = useState(initialData?.isDefault || false);
  const [profileData, setProfileData] = useState<ProfileData>((initialData?.profileData as ProfileData) || {});
  const [activeCategory, setActiveCategory] = useState(TECH_CATEGORIES[0].id);
  const [newItemName, setNewItemName] = useState("");
  const [newItemVersion, setNewItemVersion] = useState("");

  const [newItemPriority, setNewItemPriority] = useState<BaselinePriority>("recommended");

  const allItems = Object.values(profileData).flat();
  const priorityCounts = {
    required: allItems.filter(i => getItemPriority(i) === "required").length,
    recommended: allItems.filter(i => getItemPriority(i) === "recommended").length,
    optional: allItems.filter(i => getItemPriority(i) === "optional").length,
  };

  const addItem = () => {
    if (!newItemName.trim()) return;
    const items = profileData[activeCategory] || [];
    setProfileData({
      ...profileData,
      [activeCategory]: [...items, { name: newItemName.trim(), version: newItemVersion.trim() || undefined, priority: newItemPriority }],
    });
    setNewItemName("");
    setNewItemVersion("");
  };

  const removeItem = (category: string, index: number) => {
    const items = [...(profileData[category] || [])];
    items.splice(index, 1);
    setProfileData({ ...profileData, [category]: items });
  };

  const cyclePriority = (category: string, index: number) => {
    const items = [...(profileData[category] || [])];
    const current = getItemPriority(items[index]);
    const next: BaselinePriority = current === "required" ? "recommended" : current === "recommended" ? "optional" : "required";
    items[index] = { ...items[index], priority: next };
    setProfileData({ ...profileData, [category]: items });
  };

  const applyTemplate = (template: ProfileData) => {
    setProfileData(template);
    setName("Healthcare PE Standard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">{title}</DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            Define the technologies your organization standardizes on. Set priority levels for each standard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-[var(--text-disabled)]">Templates:</span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2 border-[var(--theme-border)] text-[var(--text-secondary)]"
              onClick={() => applyTemplate(HEALTHCARE_TEMPLATE)}
              data-testid="button-template-healthcare"
            >
              Healthcare PE Standard
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[var(--text-secondary)] text-xs mb-1.5 block">Profile Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Enterprise Standard Stack"
                className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-sm"
                data-testid="input-baseline-name"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2">
                <Switch checked={isDefault} onCheckedChange={setIsDefault} data-testid="switch-baseline-default" />
                <Label className="text-xs text-[var(--text-secondary)]">Set as default profile</Label>
              </div>
            </div>
          </div>

          <div className="border border-[var(--theme-border)]/50 rounded-lg overflow-hidden">
            <div className="flex overflow-x-auto border-b border-[var(--theme-border)]/50 bg-[var(--bg-panel)]">
              {TECH_CATEGORIES.map(cat => {
                const count = profileData[cat.id]?.length || 0;
                const CatIcon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer ${
                      activeCategory === cat.id
                        ? "border-blue-500 text-blue-400"
                        : "border-transparent text-[var(--text-disabled)] hover:text-[var(--text-secondary)]"
                    }`}
                    data-testid={`tab-baseline-category-${cat.id}`}
                  >
                    <CatIcon className="w-3 h-3" />
                    {cat.label}
                    {count > 0 && (
                      <span className="text-[9px] font-data bg-blue-500/15 text-blue-400 rounded px-1">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-3">
              <div className="flex gap-2 mb-3">
                <Select value={newItemPriority} onValueChange={(v) => setNewItemPriority(v as BaselinePriority)}>
                  <SelectTrigger className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-xs w-32 h-9" data-testid="select-new-item-priority">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${PRIORITY_STYLES[newItemPriority].dot}`} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Required</div></SelectItem>
                    <SelectItem value="recommended"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Recommended</div></SelectItem>
                    <SelectItem value="optional"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400" />Optional</div></SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Technology name (e.g., Cisco Meraki)"
                  className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-xs flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
                  data-testid="input-baseline-tech-name"
                />
                <Input
                  value={newItemVersion}
                  onChange={(e) => setNewItemVersion(e.target.value)}
                  placeholder="Version"
                  className="bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-xs w-24"
                  onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
                  data-testid="input-baseline-tech-version"
                />
                <Button
                  onClick={addItem}
                  disabled={!newItemName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9"
                  data-testid="button-add-baseline-tech"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              {(profileData[activeCategory] || []).length === 0 ? (
                <div className="text-center py-6 text-[var(--text-disabled)] text-xs">
                  No technologies added for this category yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {(profileData[activeCategory] || []).map((item, i) => {
                    const pri = getItemPriority(item);
                    const ps = PRIORITY_STYLES[pri];
                    return (
                      <div key={i} className={`flex items-center gap-2 py-1.5 px-2 rounded bg-[var(--bg-panel)] border border-[var(--theme-border)]/30 border-l-2 ${ps.border}`}>
                        <span className="text-xs text-[var(--text-primary)] flex-1">{item.name}</span>
                        {item.version && (
                          <span className="text-[10px] font-data text-[var(--text-disabled)]">{item.version}</span>
                        )}
                        <button
                          onClick={() => cyclePriority(activeCategory, i)}
                          className={`text-[9px] font-medium px-1.5 py-0.5 rounded cursor-pointer flex items-center gap-1 ${ps.bg} ${ps.text}`}
                          data-testid={`toggle-priority-${i}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${ps.dot}`} />
                          {ps.label}
                        </button>
                        <button
                          onClick={() => removeItem(activeCategory, i)}
                          className="text-[var(--text-disabled)] hover:text-red-400 cursor-pointer"
                          data-testid={`button-remove-tech-${i}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {allItems.length > 0 && (
          <div className="flex items-center gap-3 text-[10px] font-data px-1 py-1" data-testid="priority-summary">
            <span className="text-red-400">{priorityCounts.required} Required</span>
            <span className="text-[var(--text-disabled)]">&bull;</span>
            <span className="text-amber-400">{priorityCounts.recommended} Recommended</span>
            <span className="text-[var(--text-disabled)]">&bull;</span>
            <span className="text-gray-400">{priorityCounts.optional} Optional</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[var(--theme-border)] text-[var(--text-secondary)]">
            Cancel
          </Button>
          <Button
            onClick={() => onSave({ name, profileData, isDefault })}
            disabled={!name.trim() || isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-save-baseline"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditLogTab() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const { data: members = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/org/members"],
  });

  const queryParams = new URLSearchParams();
  queryParams.set("limit", String(limit));
  queryParams.set("offset", String(offset));
  if (actionFilter !== "all") queryParams.set("action", actionFilter);
  if (userFilter !== "all") queryParams.set("userId", userFilter);

  const { data, isLoading } = useQuery<{ entries: AuditLogEntry[]; total: number }>({
    queryKey: ["/api/org/audit-log", actionFilter, userFilter, offset],
    queryFn: async () => {
      const res = await fetch(`/api/org/audit-log?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const entries = data?.entries || [];
  const total = data?.total || 0;
  const hasMore = offset + limit < total;

  const memberMap = new Map(members.map((m) => [m.id, m]));

  const actionTypes = [
    "login", "register", "create_deal", "deal_created", "deal_updated",
    "finding_added", "document_uploaded", "user_invited", "user_removed",
    "role_changed", "settings_changed", "chat_query", "ownership_transferred",
    "deal_access_updated", "user_disabled",
  ];

  function getActionDescription(entry: AuditLogEntry): string {
    const base = AUDIT_ACTION_LABELS[entry.action] || entry.action;
    const details = entry.detailsJson as Record<string, any> | null;
    if (!details) return base;

    if (entry.action === "create_deal" || entry.action === "deal_created") {
      return `${base}: ${details.targetName || ""}`;
    }
    if (entry.action === "user_invited") {
      return `${base}: ${details.email || ""} as ${roleLabel(details.role || "")}`;
    }
    if (entry.action === "role_changed") {
      return `${base}: ${roleLabel(details.oldRole || "")} → ${roleLabel(details.newRole || "")}`;
    }
    if (entry.action === "user_removed") {
      return `${base}: ${details.name || details.email || ""}`;
    }
    return base;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setOffset(0); }}>
          <SelectTrigger className="w-[180px] bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-xs" data-testid="select-audit-action">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
            <SelectItem value="all">All Actions</SelectItem>
            {actionTypes.map((a) => (
              <SelectItem key={a} value={a}>{AUDIT_ACTION_LABELS[a] || a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setOffset(0); }}>
          <SelectTrigger className="w-[180px] bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)] text-xs" data-testid="select-audit-user">
            <SelectValue placeholder="All users" />
          </SelectTrigger>
          <SelectContent className="bg-[var(--bg-card)] border-[var(--theme-border)]">
            <SelectItem value="all">All Users</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-[var(--text-disabled)] text-xs font-data ml-auto">{total} entries</span>
      </div>

      <Card className="bg-[var(--bg-card)] border-[var(--theme-border)]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-disabled)] text-sm">No audit log entries found.</div>
        ) : (
          <div className="divide-y divide-[var(--theme-border)]/30">
            {entries.map((entry) => {
              const actor = memberMap.get(entry.userId);
              return (
                <div key={entry.id} className="flex items-start gap-3 py-3 px-4" data-testid={`audit-entry-${entry.id}`}>
                  <Avatar className="w-7 h-7 mt-0.5 flex-shrink-0">
                    <AvatarFallback className={`text-[10px] font-data ${actor ? ROLE_AVATAR_COLORS[actor.role] || ROLE_AVATAR_COLORS.viewer : "bg-gray-500/20 text-gray-400"}`}>
                      {actor ? getInitials(actor.name) : "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-[var(--text-primary)] font-medium">{actor?.name || "Unknown"}</span>
                      <span className="text-sm text-[var(--text-secondary)]">{getActionDescription(entry)}</span>
                    </div>
                    <span className="text-[10px] font-data text-[var(--text-disabled)]">
                      {entry.createdAt
                        ? new Date(entry.createdAt).toLocaleString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                            hour: "2-digit", minute: "2-digit", hour12: false,
                          })
                        : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button
            variant="outline"
            onClick={() => setOffset((o) => o + limit)}
            data-testid="button-load-more"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}

function PlatformTab() {
  const { toast } = useToast();
  const { organization } = useAuth();
  const ownerOrgName = organization?.name || "the platform owner's organization";
  const [sterilizeOpen, setSterilizeOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const sterilizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/platform/sterilize");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Platform sterilized", description: "All demo data has been removed." });
      setSterilizeOpen(false);
      setConfirmText("");
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      toast({ title: "Sterilization failed", description: err.message, variant: "destructive" });
    },
  });

  const { data: orgs = [] } = useQuery<any[]>({
    queryKey: ["/api/platform/organizations"],
  });

  const { data: platformUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/org/members"],
  });

  return (
    <div className="space-y-6">
      <Card className="bg-[var(--bg-card)] border-[var(--theme-border)] p-6">
        <h3 className="text-[var(--text-primary)] font-semibold mb-4">Platform Overview</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--bg-panel)] rounded-lg p-4 border border-[var(--theme-border)]">
            <div className="text-2xl font-data text-[var(--text-primary)]" data-testid="text-org-count">{orgs.length}</div>
            <div className="text-xs text-[var(--text-disabled)] mt-1">Organizations</div>
          </div>
          <div className="bg-[var(--bg-panel)] rounded-lg p-4 border border-[var(--theme-border)]">
            <div className="text-2xl font-data text-[var(--text-primary)]" data-testid="text-user-count">{platformUsers.length}</div>
            <div className="text-xs text-[var(--text-disabled)] mt-1">Platform Users</div>
          </div>
          <div className="bg-[var(--bg-panel)] rounded-lg p-4 border border-[var(--theme-border)]">
            <div className="text-2xl font-data text-[var(--text-primary)]" data-testid="text-active-orgs">{orgs.filter((o: any) => o.isActive).length}</div>
            <div className="text-xs text-[var(--text-disabled)] mt-1">Active Orgs</div>
          </div>
        </div>
      </Card>

      <Card className="bg-[var(--bg-card)] border-red-500/30 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <Flame className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-[var(--text-primary)] font-semibold">Danger Zone</h3>
            <p className="text-sm text-[var(--text-disabled)] mt-1 mb-4">
              Permanently remove all tenant organizations, users, deals, documents, findings, and associated data.
              Only {ownerOrgName} and platform staff will be preserved.
            </p>
            <Button
              variant="destructive"
              onClick={() => setSterilizeOpen(true)}
              data-testid="button-sterilize"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Sterilize Platform
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={sterilizeOpen} onOpenChange={(open) => { setSterilizeOpen(open); if (!open) setConfirmText(""); }}>
        <DialogContent className="bg-[var(--bg-card)] border-[var(--theme-border)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Permanently Remove All Data
            </DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)] mt-2">
              This will delete all organizations (except {ownerOrgName}), all users (except platform staff),
              all deals, documents, findings, and associated data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-[var(--text-secondary)] text-sm">
                Type <span className="font-mono font-bold text-red-400">STERILIZE</span> to confirm
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type STERILIZE"
                className="mt-2 bg-[var(--bg-panel)] border-[var(--theme-border)] text-[var(--text-primary)]"
                data-testid="input-sterilize-confirm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setSterilizeOpen(false); setConfirmText(""); }}
              className="border-[var(--theme-border)] text-[var(--text-secondary)]"
              data-testid="button-sterilize-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "STERILIZE" || sterilizeMutation.isPending}
              onClick={() => sterilizeMutation.mutate()}
              data-testid="button-sterilize-confirm"
            >
              {sterilizeMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Flame className="w-4 h-4 mr-2" />
              )}
              Sterilize Platform
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BrandingTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const [form, setForm] = useState({
    companyName: "",
    logoUrl: "",
    logoWidthPx: 200,
    primaryColor: "#1a56db",
    secondaryColor: "#6b7280",
    accentColor: "#059669",
    reportHeaderText: "IT Due Diligence Assessment",
    reportFooterText: "",
    confidentialityNotice: "CONFIDENTIAL — For intended recipients only.",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    showMeridianBadge: true,
    customCoverPage: false,
  });

  const brandingQuery = useQuery({
    queryKey: ["/api/settings/branding"],
    enabled: !!user,
  });

  const initializedRef = useRef(false);

  useEffect(() => {
    if (brandingQuery.data && !initializedRef.current) {
      initializedRef.current = true;
      const b = brandingQuery.data as any;
      if (b && typeof b === "object" && b.id) {
        setForm({
          companyName: b.companyName || "",
          logoUrl: b.logoUrl || "",
          logoWidthPx: b.logoWidthPx ?? 200,
          primaryColor: b.primaryColor || "#1a56db",
          secondaryColor: b.secondaryColor || "#6b7280",
          accentColor: b.accentColor || "#059669",
          reportHeaderText: b.reportHeaderText || "IT Due Diligence Assessment",
          reportFooterText: b.reportFooterText || "",
          confidentialityNotice: b.confidentialityNotice || "CONFIDENTIAL — For intended recipients only.",
          contactName: b.contactName || "",
          contactEmail: b.contactEmail || "",
          contactPhone: b.contactPhone || "",
          website: b.website || "",
          showMeridianBadge: b.showMeridianBadge ?? true,
          customCoverPage: b.customCoverPage ?? false,
        });
        if (b.logoUrl) setLogoPreview(b.logoUrl);
      }
    }
  }, [brandingQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("PUT", "/api/settings/branding", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/branding"] });
      toast({ title: "Branding settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save branding", variant: "destructive" });
    },
  });

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo must be under 2MB", variant: "destructive" });
      return;
    }

    const allowed = ["image/png", "image/jpeg", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Only PNG, JPG, and SVG files allowed", variant: "destructive" });
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    setIsUploadingLogo(true);
    try {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
      const csrfHeaders: Record<string, string> = csrfMatch
        ? { "X-XSRF-TOKEN": decodeURIComponent(csrfMatch[1]) }
        : {};
      const res = await fetch("/api/settings/branding/logo", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-File-Type": logoFile.type,
          ...csrfHeaders,
        },
        body: logoFile,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      const data = await res.json();
      setForm((prev) => ({ ...prev, logoUrl: data.logoUrl }));
      setLogoFile(null);
      toast({ title: "Logo uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/branding"] });
    } catch (err: any) {
      toast({ title: err.message || "Upload failed", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (brandingQuery.isLoading) {
    return (
      <Card className="p-8 bg-[var(--bg-card)] border-[var(--theme-border)]">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--text-disabled)]" />
          <span className="text-[var(--text-secondary)] text-sm">Loading branding settings...</span>
        </div>
      </Card>
    );
  }

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-[var(--bg-card)] border-[var(--theme-border)]">
        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-5">Report Branding</h3>

        <div className="space-y-6">
          <div>
            <Label className="text-sm text-[var(--text-secondary)] mb-2 block">Company Logo</Label>
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 rounded-lg border border-[var(--theme-border)] bg-[var(--bg-surface)] flex items-center justify-center overflow-hidden">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" data-testid="img-logo-preview" />
                ) : (
                  <Palette className="w-8 h-8 text-[var(--text-disabled)]" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg"
                    className="hidden"
                    onChange={handleLogoSelect}
                    data-testid="input-logo-file"
                  />
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-[var(--theme-border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors">
                    <Upload className="w-4 h-4" />
                    Choose File
                  </span>
                </label>
                {logoFile && (
                  <Button
                    size="sm"
                    onClick={handleLogoUpload}
                    disabled={isUploadingLogo}
                    data-testid="button-upload-logo"
                  >
                    {isUploadingLogo ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                    Upload Logo
                  </Button>
                )}
                <p className="text-xs text-[var(--text-disabled)]">Max 2MB, PNG/JPG/SVG</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-sm text-[var(--text-secondary)] mb-1 block">Logo Width (px)</Label>
              <Input
                type="number"
                min={50}
                max={500}
                value={form.logoWidthPx}
                onChange={(e) => updateField("logoWidthPx", parseInt(e.target.value) || 200)}
                className="bg-[var(--bg-surface)] border-[var(--theme-border)] text-[var(--text-primary)] w-28"
                data-testid="input-logo-width"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm text-[var(--text-secondary)] mb-1 block">Company Name</Label>
            <Input
              value={form.companyName}
              onChange={(e) => updateField("companyName", e.target.value)}
              placeholder="Your Company Name"
              className="bg-[var(--bg-surface)] border-[var(--theme-border)] text-[var(--text-primary)]"
              data-testid="input-company-name"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-sm text-[var(--text-secondary)] mb-1 block">Primary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => updateField("primaryColor", e.target.value)}
                  className="w-10 h-10 rounded border border-[var(--theme-border)] cursor-pointer bg-transparent"
                  data-testid="input-primary-color"
                />
                <Input
                  value={form.primaryColor}
                  onChange={(e) => updateField("primaryColor", e.target.value)}
                  className="bg-[var(--bg-surface)] border-[var(--theme-border)] text-[var(--text-primary)] w-28 font-mono text-xs"
                  data-testid="input-primary-color-hex"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm text-[var(--text-secondary)] mb-1 block">Secondary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={(e) => updateField("secondaryColor", e.target.value)}
                  className="w-10 h-10 rounded border border-[var(--theme-border)] cursor-pointer bg-transparent"
                  data-testid="input-secondary-color"
                />
                <Input
                  value={form.secondaryColor}
                  onChange={(e) => updateField("secondaryColor", e.target.value)}
                  className="bg-[var(--bg-surface)] border-[var(--theme-border)] text-[var(--text-primary)] w-28 font-mono text-xs"
                  data-testid="input-secondary-color-hex"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm text-[var(--text-secondary)] mb-1 block">Accent Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => updateField("accentColor", e.target.value)}
                  className="w-10 h-10 rounded border border-[var(--theme-border)] cursor-pointer bg-transparent"
                  data-testid="input-accent-color"
                />
                <Input
                  value={form.accentColor}
                  onChange={(e) => updateField("accentColor", e.target.value)}
                  className="bg-[var(--bg-surface)] border-[var(--theme-border)] text-[var(--text-primary)] w-28 font-mono text-xs"
                  data-testid="input-accent-color-hex"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-[var(--text-secondary)] mb-1 block">Report Header</Label>
              <Input
                value={form.reportHeaderText}
                onChange={(e) => updateField("reportHeaderText", e.target.value)}
                placeholder="IT Due Diligence Assessment"
                className="bg-[var(--bg-surface)] border-[var(--theme-border)] text-[var(--text-primary)]"
                data-testid="input-report-header"
              />
            </div>
            <div>
              <Label className="text-sm text-[var(--text-secondary)] mb-1 block">Report Footer</Label>
              <Input
                value={form.reportFooterText}
                onChange={(e) => updateField("reportFooterText", e.target.value)}
                placeholder="Prepared by Your Company"
                className="bg-[var(--bg-surface)] border-[var(--theme-border)] text-[var(--text-primary)]"
                data-testid="input-report-footer"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm text-[var(--text-secondary)] mb-1 block">Confidentiality Notice</Label>
            <Textarea
              value={form.confidentialityNotice}
              onChange={(e) => updateField("confidentialityNotice", e.target.value)}
              rows={2}
              className="bg-[var(--bg-surface)] border-[var(--theme-border)] text-[var(--text-primary)] text-sm resize-none"
              data-testid="input-confidentiality"
            />
          </div>

          <div>
            <Label className="text-sm text-[var(--text-secondary)] mb-3 block">Contact Information (shown on cover page)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-[var(--text-disabled)] mb-1 block">Name</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) => updateField("contactName", e.target.value)}
                  className="bg-[var(--bg-surface)] border-[var(--theme-border)] text-[var(--text-primary)]"
                  data-testid="input-contact-name"
                />
              </div>
              <div>
                <Label className="text-xs text-[var(--text-disabled)] mb-1 block">Email</Label>
                <Input
                  value={form.contactEmail}
                  onChange={(e) => updateField("contactEmail", e.target.value)}
                  className="bg-[var(--bg-surface)] border-[var(--theme-border)] text-[var(--text-primary)]"
                  data-testid="input-contact-email"
                />
              </div>
              <div>
                <Label className="text-xs text-[var(--text-disabled)] mb-1 block">Phone</Label>
                <Input
                  value={form.contactPhone}
                  onChange={(e) => updateField("contactPhone", e.target.value)}
                  className="bg-[var(--bg-surface)] border-[var(--theme-border)] text-[var(--text-primary)]"
                  data-testid="input-contact-phone"
                />
              </div>
              <div>
                <Label className="text-xs text-[var(--text-disabled)] mb-1 block">Website</Label>
                <Input
                  value={form.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  className="bg-[var(--bg-surface)] border-[var(--theme-border)] text-[var(--text-primary)]"
                  data-testid="input-website"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.showMeridianBadge}
              onCheckedChange={(v) => updateField("showMeridianBadge", v)}
              data-testid="switch-meridian-badge"
            />
            <Label className="text-sm text-[var(--text-primary)]">
              Show "Powered by MERIDIAN" badge on reports
            </Label>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-[var(--bg-card)] border-[var(--theme-border)]">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Live Preview</h3>
        </div>

        <div
          className="rounded-lg border-2 overflow-hidden"
          style={{ borderColor: form.primaryColor || "#1a56db" }}
        >
          <div className="p-6" style={{ backgroundColor: form.primaryColor || "#1a56db" }}>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="h-12 object-contain bg-white/10 rounded p-1" style={{ maxWidth: form.logoWidthPx }} data-testid="img-preview-logo" />
              ) : (
                <div className="text-white/80 text-xl font-bold tracking-wide">
                  {form.companyName || "MERIDIAN"}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] p-6 space-y-3">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {form.reportHeaderText || "IT Due Diligence Assessment"}
            </h2>
            <div className="h-px" style={{ backgroundColor: form.secondaryColor || "#6b7280", opacity: 0.3 }} />

            <div className="grid grid-cols-2 gap-2 text-sm text-[var(--text-secondary)]">
              <div>
                <span className="text-[var(--text-disabled)]">Deal Name:</span>{" "}
                <span className="text-[var(--text-primary)]">Sample Deal</span>
              </div>
              <div>
                <span className="text-[var(--text-disabled)]">Prepared for:</span>{" "}
                <span className="text-[var(--text-primary)]">Client Name</span>
              </div>
              <div>
                <span className="text-[var(--text-disabled)]">Date:</span>{" "}
                <span className="text-[var(--text-primary)]">{today}</span>
              </div>
              <div>
                <span className="text-[var(--text-disabled)]">Status:</span>{" "}
                <span style={{ color: form.accentColor || "#059669" }}>Active</span>
              </div>
            </div>

            {(form.contactName || form.contactEmail) && (
              <div className="pt-2 text-xs text-[var(--text-disabled)]">
                {form.contactName && <div>{form.contactName}</div>}
                {form.contactEmail && <div>{form.contactEmail}</div>}
                {form.contactPhone && <div>{form.contactPhone}</div>}
                {form.website && <div>{form.website}</div>}
              </div>
            )}
          </div>

          <div className="px-6 py-3 flex items-center justify-between" style={{ backgroundColor: form.secondaryColor || "#6b7280", opacity: 0.9 }}>
            <span className="text-xs text-white/80">
              {form.reportFooterText || "Prepared by " + (form.companyName || "MERIDIAN")}
            </span>
            {form.showMeridianBadge && (
              <span className="text-xs text-white/60 italic">Powered by MERIDIAN</span>
            )}
          </div>
        </div>

        <p className="text-xs text-[var(--text-disabled)] mt-3 text-center">
          {form.confidentialityNotice}
        </p>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="px-6"
          data-testid="button-save-branding"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Save Branding Settings
        </Button>
      </div>
    </div>
  );
}
