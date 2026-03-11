import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Users, UserPlus, Shield, Building2, X, Loader2 } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  platform_owner: "Platform Owner",
  platform_admin: "Platform Admin",
  tenant_admin: "Admin",
  user: "User",
  viewer: "Viewer",
};

const ASSIGNABLE_ROLES = ["tenant_admin", "user", "viewer"] as const;

export default function AdminPage() {
  const { user, organization, hasPermission } = useAuth();
  const canInvite = hasPermission("invite_users");
  const canChangeRoles = hasPermission("change_roles");
  const canManageOrg = hasPermission("manage_org_settings");

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("user");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [orgName, setOrgName] = useState(organization?.name || "");

  const { data: orgUsers, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    enabled: canInvite,
  });

  const { data: orgInfo } = useQuery<any>({
    queryKey: ["/api/admin/organization"],
    enabled: canManageOrg,
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/admin/users", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowInvite(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("user");
      setInvitePassword("");
      setInviteError("");
    },
    onError: (err: any) => setInviteError(err.message || "Failed to invite user"),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("PATCH", "/api/admin/organization", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organization"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    if (!inviteEmail || !inviteName || !invitePassword) {
      setInviteError("All fields are required");
      return;
    }
    inviteMutation.mutate({ email: inviteEmail, name: inviteName, role: inviteRole, password: invitePassword });
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Organization Management</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Manage users, roles, and organization settings
        </p>
      </div>

      {/* Organization Settings */}
      {canManageOrg && orgInfo && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wide">Organization</h3>
          <div className="p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)] space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="text-sm font-medium text-[var(--text-primary)] bg-transparent border-b border-transparent hover:border-[var(--theme-border)] focus:border-amber-500 focus:outline-none transition-colors w-full"
                />
                <p className="text-xs text-[var(--text-secondary)]">
                  {orgInfo.userCount} / {orgInfo.maxUsers} users · {orgInfo.planTier} plan
                </p>
              </div>
              {orgName !== organization?.name && (
                <button
                  onClick={() => updateOrgMutation.mutate(orgName)}
                  className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600"
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Management */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide">Team Members</h3>
          {canInvite && (
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 font-medium"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite User
            </button>
          )}
        </div>

        {/* Invite Form */}
        {showInvite && (
          <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-[var(--bg-card)]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-[var(--text-primary)]">Invite New User</h4>
              <button onClick={() => setShowInvite(false)} className="text-[var(--text-disabled)] hover:text-[var(--text-primary)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Full name"
                className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <input
                type="password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder="Initial password"
                className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <div className="col-span-2 flex items-center justify-between">
                {inviteError && <p className="text-xs text-red-400">{inviteError}</p>}
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="ml-auto flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Create User
                </button>
              </div>
            </form>
          </div>
        )}

        {/* User List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orgUsers && orgUsers.length > 0 ? (
          <div className="space-y-2">
            {orgUsers.map((u: any) => (
              <div
                key={u.id}
                className="p-3 rounded-xl border border-[var(--theme-border)] bg-[var(--bg-card)] flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-xs font-bold">
                  {u.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {u.name}
                    {u.id === user?.id && <span className="text-xs text-[var(--text-disabled)] ml-2">(you)</span>}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{u.email}</p>
                </div>

                {canChangeRoles && u.id !== user?.id ? (
                  <select
                    value={u.role}
                    onChange={(e) => changeRoleMutation.mutate({ id: u.id, role: e.target.value })}
                    className="px-2 py-1 bg-[var(--bg-primary)] border border-[var(--theme-border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-500">
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                )}

                {canChangeRoles && u.id !== user?.id && (
                  <button
                    onClick={() => toggleStatusMutation.mutate({
                      id: u.id,
                      status: u.status === "active" ? "inactive" : "active",
                    })}
                    className={`text-xs px-2 py-1 rounded-full ${
                      u.status === "active"
                        ? "bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:text-red-400"
                        : "bg-red-500/10 text-red-400 hover:bg-green-500/10 hover:text-green-400"
                    } transition-colors cursor-pointer`}
                  >
                    {u.status === "active" ? "Active" : "Inactive"}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-[var(--text-disabled)] mx-auto mb-3" />
            <p className="text-[var(--text-secondary)]">No team members found</p>
          </div>
        )}
      </div>
    </div>
  );
}
