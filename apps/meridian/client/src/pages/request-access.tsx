import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Shield, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FREE_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com", "mail.com", "protonmail.com", "live.com", "msn.com"];

const INDUSTRIES = [
  "Private Equity",
  "Managed Service Provider",
  "IT Consultancy",
  "Corporate M&A",
  "Other",
];

export default function RequestAccessPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const { data: versionData } = useQuery<{ version: string }>({ queryKey: ["/api/version"] });
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [estimatedDeals, setEstimatedDeals] = useState("");
  const [estimatedUsers, setEstimatedUsers] = useState("");
  const [message, setMessage] = useState("");
  const [emailError, setEmailError] = useState("");

  const validateEmail = (value: string) => {
    setEmail(value);
    if (!value) { setEmailError(""); return; }
    const domain = value.split("@")[1]?.toLowerCase();
    if (domain && FREE_EMAIL_DOMAINS.includes(domain)) {
      setEmailError("Please use your company email address");
    } else {
      setEmailError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailError) return;
    if (!companyName || !contactName || !email) {
      toast({ title: "Missing fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/account-requests", {
        companyName,
        contactName,
        email,
        phone: phone || undefined,
        industry: industry || undefined,
        estimatedDealsPerYear: estimatedDeals ? parseInt(estimatedDeals) : undefined,
        estimatedUsers: estimatedUsers ? parseInt(estimatedUsers) : undefined,
        notes: message || undefined,
      });
      setSubmittedEmail(email);
      setSubmitted(true);
    } catch (err: any) {
      let msg = err.message;
      try { msg = JSON.parse(msg)?.message || msg; } catch {}
      toast({ title: "Submission failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="w-full max-w-[520px] px-4">
          <Card className="p-8 border-[var(--theme-border)] text-center" style={{ background: "var(--bg-card)" }}>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Request Submitted</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Thank you. Your request has been submitted. We review requests within 1–2 business days.
              You'll receive an email at <span className="text-[var(--text-primary)] font-medium">{submittedEmail}</span> when your account is ready.
            </p>
            <Button
              variant="outline"
              data-testid="button-back-to-login"
              className="border-[var(--theme-border)] text-[var(--text-secondary)]"
              onClick={() => setLocation("/login")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-[520px] px-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight font-data">MERIDIAN</h1>
          </div>
        </div>

        <Card className="p-6 border-[var(--theme-border)]" style={{ background: "var(--bg-card)" }}>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Request Access to MERIDIAN</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              MERIDIAN is available to qualified private equity firms, managed service providers, and IT consultancies.
              Tell us about your organization and we'll be in touch.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[var(--text-secondary)] text-sm">Company Name <span className="text-red-400">*</span></Label>
              <Input
                data-testid="input-company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Capital Partners"
                className="border-[var(--theme-border)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                style={{ background: "var(--bg-panel)" }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--text-secondary)] text-sm">Your Name <span className="text-red-400">*</span></Label>
              <Input
                data-testid="input-contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Jane Smith"
                className="border-[var(--theme-border)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                style={{ background: "var(--bg-panel)" }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--text-secondary)] text-sm">Work Email <span className="text-red-400">*</span></Label>
              <Input
                data-testid="input-email"
                type="email"
                value={email}
                onChange={(e) => validateEmail(e.target.value)}
                placeholder="you@company.com"
                className={`border-[var(--theme-border)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] ${emailError ? "border-red-500" : ""}`}
                style={{ background: "var(--bg-panel)" }}
                required
              />
              {emailError && <p className="text-xs text-red-400">{emailError}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--text-secondary)] text-sm">Phone</Label>
              <Input
                data-testid="input-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="border-[var(--theme-border)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                style={{ background: "var(--bg-panel)" }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--text-secondary)] text-sm">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger
                  data-testid="select-industry"
                  className="border-[var(--theme-border)] text-[var(--text-primary)]"
                  style={{ background: "var(--bg-panel)" }}
                >
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)] text-sm">Estimated Deals/Year</Label>
                <Select value={estimatedDeals} onValueChange={setEstimatedDeals}>
                  <SelectTrigger
                    data-testid="select-deals"
                    className="border-[var(--theme-border)] text-[var(--text-primary)]"
                    style={{ background: "var(--bg-panel)" }}
                  >
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">1–5</SelectItem>
                    <SelectItem value="10">6–15</SelectItem>
                    <SelectItem value="23">16–30</SelectItem>
                    <SelectItem value="31">31+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)] text-sm">Estimated Users</Label>
                <Select value={estimatedUsers} onValueChange={setEstimatedUsers}>
                  <SelectTrigger
                    data-testid="select-users"
                    className="border-[var(--theme-border)] text-[var(--text-primary)]"
                    style={{ background: "var(--bg-panel)" }}
                  >
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">1–5</SelectItem>
                    <SelectItem value="10">6–15</SelectItem>
                    <SelectItem value="33">16–50</SelectItem>
                    <SelectItem value="51">51+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--text-secondary)] text-sm">Tell us about your use case</Label>
              <Textarea
                data-testid="input-message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                placeholder="Describe your M&A IT diligence needs..."
                className="border-[var(--theme-border)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] min-h-[80px]"
                style={{ background: "var(--bg-panel)" }}
              />
              <p className="text-xs text-[var(--text-disabled)] text-right">{message.length}/500</p>
            </div>

            <Button
              type="submit"
              data-testid="button-submit-request"
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
              disabled={loading || !!emailError}
            >
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              data-testid="link-back-login"
              className="text-xs text-[var(--text-secondary)] hover:text-blue-400 transition-colors"
              onClick={() => setLocation("/login")}
            >
              <ArrowLeft className="w-3 h-3 inline mr-1" />
              Back to Sign In
            </button>
          </div>
        </Card>

        <div className="text-center mt-6">
          <span className="text-[11px] font-data text-[var(--text-disabled)]" data-testid="text-version-footer">MERIDIAN v{versionData?.version || "..."}</span>
        </div>
      </div>
    </div>
  );
}
