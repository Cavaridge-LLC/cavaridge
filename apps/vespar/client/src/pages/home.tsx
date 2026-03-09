import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Cloud, Server, Database, ArrowRight, ArrowRightCircle, ShieldCheck, Zap } from "lucide-react";
import heroBg from "@/assets/hero-bg.png";

export default function Home() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-secondary/20 rounded-full blur-3xl translate-y-1/4 -translate-x-1/4 pointer-events-none" />

      {/* Header */}
      <header className="absolute top-0 w-full p-6 flex justify-between items-center z-10 glass-panel border-b border-white/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-sm">
            <Cloud size={20} />
          </div>
          <span className="font-heading font-bold text-xl tracking-tight text-foreground">SkyShift</span>
        </div>
        <nav className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
          <Link href="#" className="hover:text-primary transition-colors">How it works</Link>
          <Link href="#" className="hover:text-primary transition-colors">Security</Link>
          <Link href="#" className="hover:text-primary transition-colors">Pricing</Link>
        </nav>
        <Button onClick={() => setLocation("/wizard")} className="rounded-full px-6 shadow-sm">
          Start Free
        </Button>
      </header>

      {/* Main Hero */}
      <main className="pt-32 pb-20 px-6 max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16 relative z-10">
        <div className="flex-1 space-y-8 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/30 text-secondary-foreground text-sm font-medium border border-secondary/20 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Migration made simple
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-bold font-heading text-foreground leading-[1.1] tracking-tight">
            Design your cloud migration <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">in minutes.</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed font-light">
            No technical jargon. No endless spreadsheets. Just tell us where you are and where you want to go, and we'll generate the blueprint.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
            <Button 
              size="lg" 
              className="rounded-full px-8 text-base h-14 shadow-md hover:shadow-lg transition-all"
              onClick={() => setLocation("/wizard")}
              data-testid="btn-start-wizard"
            >
              Start Migration Design
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="rounded-full px-8 text-base h-14 border-border/50 bg-white/50 backdrop-blur-sm"
              data-testid="btn-watch-demo"
            >
              Watch Demo
            </Button>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="flex-1 w-full max-w-md lg:max-w-none relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent rounded-3xl transform rotate-3 scale-105 blur-xl -z-10" />
          <img 
            src={heroBg} 
            alt="Cloud Tech Illustration" 
            className="w-full h-auto rounded-3xl shadow-2xl shadow-primary/10 border border-white/20 object-cover"
            data-testid="img-hero"
          />
          
          {/* Floating UI Elements */}
          <Card className="absolute -bottom-8 -left-8 p-4 glass-panel rounded-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="font-semibold text-sm font-heading">Secure Transfer</p>
                <p className="text-xs text-muted-foreground">End-to-end encrypted</p>
              </div>
            </div>
          </Card>

          <Card className="absolute -top-8 -right-8 p-4 glass-panel rounded-2xl animate-in fade-in slide-in-from-top-8 duration-700 delay-500">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-primary">
                <Zap size={24} />
              </div>
              <div>
                <p className="font-semibold text-sm font-heading">Fast Setup</p>
                <p className="text-xs text-muted-foreground">Ready in 3 steps</p>
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* Simple How it works */}
      <section className="bg-white/50 backdrop-blur-md py-24 border-t border-border/40 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-heading mb-4">How it works</h2>
            <p className="text-muted-foreground">Three simple steps to your new cloud home.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Server, title: "1. Tell us what you have", desc: "Select your current setup, like physical servers or another cloud provider." },
              { icon: Cloud, title: "2. Choose your destination", desc: "Pick where you want to go. We support AWS, Azure, Google, and more." },
              { icon: ArrowRightCircle, title: "3. Get your blueprint", desc: "Receive a clear, simple plan with estimated costs and timelines." }
            ].map((step, i) => (
              <div key={i} className="text-center p-6 rounded-3xl hover:bg-white transition-colors duration-300 border border-transparent hover:border-border/50 shadow-sm hover:shadow-md">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                  <step.icon size={32} />
                </div>
                <h3 className="text-xl font-semibold font-heading mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-muted-foreground relative z-10 border-t border-border/40">
        © 2026 Cavaridge, LLC. All rights reserved.
      </footer>
    </div>
  );
}