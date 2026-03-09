import { Button } from "@/components/ui/button";
import { Building2, FileText, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { BRANDING } from "@shared/branding";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-md">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-900 leading-tight">{BRANDING.appName}</h1>
              <p className="text-xs text-slate-500 font-medium">Scope of Work Builder</p>
            </div>
          </div>
          <a href="/api/login">
            <Button data-testid="btn-login">Sign In</Button>
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto"
        >
          <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <FileText className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-4">
            Turn messy notes into<br />client-ready Scopes of Work
          </h2>
          <p className="text-lg text-slate-600 mb-8 max-w-lg mx-auto">
            Paste your raw meeting notes, engineer scribbles, or brain dumps. 
            Chat with Claude to fill gaps and refine details, then get a structured, 
            client-ready SoW that protects against scope creep and blame drift.
          </p>
          <a href="/api/login">
            <Button size="lg" className="px-8 py-6 text-base" data-testid="btn-get-started">
              Get Started
            </Button>
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-20"
        >
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Scope Protection</h3>
            <p className="text-sm text-slate-600">
              Automatically bakes in protections against scope creep, third-party delays, and site readiness issues.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Standard Format</h3>
            <p className="text-sm text-slate-600">
              Every SoW follows the same 11-section v2 runbook structure. Consistent, professional, implementable by an L4 engineer.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Risks & Mitigations</h3>
            <p className="text-sm text-slate-600">
              Never just a warning. Every identified risk includes actionable mitigation options baked right in.
            </p>
          </div>
        </motion.div>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        &copy; {new Date().getFullYear()} {BRANDING.parentCompany}
      </footer>
    </div>
  );
}
