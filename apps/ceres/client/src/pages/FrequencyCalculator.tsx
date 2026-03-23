import { useState, useMemo, useRef, useEffect } from "react";
import { format, addDays, isValid, parseISO, isSameDay, isWithinInterval, startOfDay, differenceInCalendarDays, nextSaturday, isSaturday, eachDayOfInterval, isWeekend, getDay } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Calendar as CalendarIcon,
  ClipboardList,
  Activity,
  Copy,
  CheckCircle2,
  MousePointerClick,
  Camera,
  Upload,
  FileImage,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
  ExternalLink,
  PenLine,
  CalendarClock,
  BarChart3
} from "lucide-react";
import { useTheme } from "next-themes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import IntervalScheduler from "@/components/IntervalScheduler";
import { computeSmartDates, SmartScheduleRationale } from "@/components/SmartScheduler";
import CalendarExport from "@/components/CalendarExport";
import Timeline from "@/components/Timeline";
import PlanComparison, { SavePlanButton, type SavedPlan } from "@/components/PlanComparison";
import { DuckyMascot } from "@/components/DuckyMascot";
import { BRANDING } from "@shared/branding";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function FrequencyCalculator() {
  const { theme, setTheme } = useTheme();
  const [socDateStr, setSocDateStr] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [activeTab, setActiveTab] = useState("visual");
  const [manualVisits, setManualVisits] = useState<number[]>(Array(10).fill(0));
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [copied, setCopied] = useState(false);
  const [frequencyInput, setFrequencyInput] = useState("");
  const [frequencyTotalInput, setFrequencyTotalInput] = useState("");

  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ detected: string, visits: number[], notes: string, confidence: string, status: 'success' | 'warning', detectedSocDate?: string, emrSystem?: string, visitDates?: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const socDate = useMemo(() => {
    const date = parseISO(socDateStr);
    return isValid(date) ? date : null;
  }, [socDateStr]);

  const episodeDetails = useMemo(() => {
    if (!socDate) return null;

    const soc = startOfDay(socDate);
    const endDate = addDays(soc, 59);
    const weeks: { weekNumber: number; startDate: Date; endDate: Date; daysInWeek: number; dayStart: number; dayEnd: number }[] = [];

    let current = soc;
    let weekNum = 1;

    while (current <= endDate) {
      let weekEnd: Date;
      if (isSaturday(current)) {
        weekEnd = current;
      } else {
        weekEnd = nextSaturday(current);
      }
      if (weekEnd > endDate) {
        weekEnd = endDate;
      }

      const dayStart = differenceInCalendarDays(current, soc) + 1;
      const dayEnd = differenceInCalendarDays(weekEnd, soc) + 1;
      const daysInWeek = dayEnd - dayStart + 1;

      weeks.push({
        weekNumber: weekNum,
        startDate: current,
        endDate: weekEnd,
        daysInWeek,
        dayStart,
        dayEnd,
      });

      current = addDays(weekEnd, 1);
      weekNum++;
    }

    return {
      startDate: soc,
      endDate,
      weeks,
    };
  }, [socDate]);

  const weekCount = episodeDetails ? episodeDetails.weeks.length : 0;

  useEffect(() => {
    if (weekCount > 0) {
      setManualVisits(prev => {
        if (prev.length === weekCount) return prev;
        const next = Array(weekCount).fill(0);
        for (let i = 0; i < Math.min(prev.length, weekCount); i++) {
          next[i] = prev[i];
        }
        return next;
      });
    }
  }, [weekCount]);

  const calculateFrequencyStr = (visitsArray: number[]) => {
    let parts = [];
    let currentVisits = visitsArray[0];
    let count = 1;

    for (let i = 1; i < visitsArray.length; i++) {
      if (visitsArray[i] === currentVisits && visitsArray[i] > 0) {
        count++;
      } else {
        if (currentVisits > 0) {
          parts.push(`${currentVisits}w${count}`);
        }
        currentVisits = visitsArray[i];
        count = 1;
      }
    }
    if (currentVisits > 0) {
      parts.push(`${currentVisits}w${count}`);
    }

    return parts.join(", ") || "No visits prescribed";
  };

  const parseFrequencyStr = (input: string, wc: number): { visits: number[]; totalVisits: number; valid: boolean; error?: string } => {
    const cleaned = input.trim();
    if (!cleaned) return { visits: Array(wc).fill(0), totalVisits: 0, valid: false, error: "Enter a frequency" };

    const segments = cleaned.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    const visits: number[] = [];

    for (const seg of segments) {
      const match = seg.match(/^(\d+)\s*[wW]\s*(\d+)$/);
      if (!match) return { visits: Array(wc).fill(0), totalVisits: 0, valid: false, error: `Invalid segment: "${seg}". Use format like 3W2` };
      const perWeek = parseInt(match[1], 10);
      const weeks = parseInt(match[2], 10);
      if (weeks < 1) return { visits: Array(wc).fill(0), totalVisits: 0, valid: false, error: `Week count must be at least 1 in "${seg}"` };
      for (let i = 0; i < weeks; i++) visits.push(perWeek);
    }

    const result = Array(wc).fill(0);
    for (let i = 0; i < Math.min(visits.length, wc); i++) result[i] = visits[i];
    const total = result.reduce((a, b) => a + b, 0);

    if (visits.length > wc) {
      return { visits: result, totalVisits: total, valid: true, error: `Frequency covers ${visits.length} weeks but episode has ${wc} — truncated` };
    }

    return { visits: result, totalVisits: total, valid: true };
  };

  const parsedFrequency = useMemo(() => {
    if (!episodeDetails) return null;
    return parseFrequencyStr(frequencyInput, episodeDetails.weeks.length);
  }, [frequencyInput, episodeDetails]);

  const derivedVisits = useMemo(() => {
    if (!episodeDetails) return [];
    const wc = episodeDetails.weeks.length;

    if (activeTab === "frequency" && parsedFrequency?.valid) {
      return parsedFrequency.visits;
    }

    if (activeTab === "manual" || activeTab === "scan" || activeTab === "interval") {
      return manualVisits.slice(0, wc);
    }

    const counts = Array(wc).fill(0);
    selectedDates.forEach(date => {
      const normalizedDate = startOfDay(date);
      for (let i = 0; i < episodeDetails.weeks.length; i++) {
        const week = episodeDetails.weeks[i];
        if (isWithinInterval(normalizedDate, { start: startOfDay(week.startDate), end: startOfDay(week.endDate) })) {
          counts[i]++;
          break;
        }
      }
    });
    return counts;
  }, [activeTab, manualVisits, selectedDates, episodeDetails, parsedFrequency]);

  const handleVisitChange = (index: number, value: string) => {
    const num = parseInt(value, 10);
    const newVisits = [...manualVisits];
    newVisits[index] = isNaN(num) ? 0 : Math.max(0, num);
    setManualVisits(newVisits);
  };

  const smartSchedule = useMemo(() => {
    if (!episodeDetails || !parsedFrequency?.valid) return { dates: [], rationale: [] };
    return computeSmartDates(episodeDetails, parsedFrequency.visits);
  }, [episodeDetails, parsedFrequency]);

  const suggestedDates = smartSchedule.dates;

  const activeDates = useMemo(() => {
    if (!episodeDetails) return [];
    if (activeTab === "frequency" && suggestedDates.length > 0) return suggestedDates;
    if (activeTab === "visual" && selectedDates.length > 0) return selectedDates;
    if ((activeTab === "manual" || activeTab === "scan") && episodeDetails) {
      return computeSmartDates(episodeDetails, derivedVisits).dates;
    }
    return [];
  }, [activeTab, suggestedDates, selectedDates, episodeDetails, derivedVisits]);

  const generatedFrequencyStr = useMemo(() => calculateFrequencyStr(derivedVisits), [derivedVisits]);
  const totalVisits = derivedVisits.reduce((a, b) => a + b, 0);

  const handleSavePlan = (plan: SavedPlan) => {
    setSavedPlans(prev => [...prev, plan]);
  };

  const handleRemovePlan = (id: string) => {
    setSavedPlans(prev => {
      const next = prev.filter(p => p.id !== id);
      if (next.length < 2) setShowComparison(false);
      return next;
    });
  };

  const handleIntervalApply = (visits: number[], dates: Date[]) => {
    const wc = episodeDetails ? episodeDetails.weeks.length : 0;
    const padded = Array(wc).fill(0);
    for (let i = 0; i < Math.min(visits.length, wc); i++) padded[i] = visits[i];
    setManualVisits(padded);
    setActiveTab("manual");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedFrequencyStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDateDisabled = (date: Date) => {
    if (!episodeDetails) return true;
    const normDate = startOfDay(date);
    return normDate < startOfDay(episodeDetails.startDate) || normDate > startOfDay(episodeDetails.endDate);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsScanning(true);
      setScanResult(null);
      setScanError(null);

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const response = await fetch("/api/scan-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to scan schedule");
        }

        const data = await response.json();
        const extractedFreqStr = calculateFrequencyStr(data.visits);
        const isMatch = generatedFrequencyStr === extractedFreqStr;

        setScanResult({
          detected: extractedFreqStr,
          visits: data.visits,
          notes: data.notes,
          confidence: data.confidence,
          status: isMatch ? "success" : "warning",
          detectedSocDate: data.socDate,
          emrSystem: data.emrSystem,
          visitDates: data.visitDates,
        });
      } catch (err: any) {
        setScanError(err.message || "Something went wrong scanning the image.");
      } finally {
        setIsScanning(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const applyScannedVisits = () => {
    if (scanResult) {
      if (scanResult.detectedSocDate) {
        setSocDateStr(scanResult.detectedSocDate);
      }
      setManualVisits(scanResult.visits);
      setActiveTab("manual");
      setScanResult(null);
    }
  };

  const applyFrequencyInput = () => {
    if (parsedFrequency?.valid) {
      setManualVisits(parsedFrequency.visits);
      setActiveTab("manual");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          All Tools
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-xl text-primary">
              <Activity className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                60-Day Frequency Calculator
              </h1>
              <p className="text-muted-foreground mt-1">Medicare home health visit frequency calculator</p>
            </div>
            <DuckyMascot state="idle" size="sm" className="ml-2" />
          </div>
          <div className="flex items-center gap-1">
            <Button
              data-testid="button-theme-light"
              variant={theme === "light" ? "default" : "outline"}
              size="icon"
              className="rounded-full h-9 w-9"
              onClick={() => setTheme("light")}
              title="Light theme"
            >
              <Sun className="h-4 w-4" />
            </Button>
            <Button
              data-testid="button-theme-dark"
              variant={theme === "dark" ? "default" : "outline"}
              size="icon"
              className="rounded-full h-9 w-9"
              onClick={() => setTheme("dark")}
              title="Dark theme"
            >
              <Moon className="h-4 w-4" />
            </Button>
            <Button
              data-testid="button-theme-system"
              variant={theme === "system" ? "default" : "outline"}
              size="icon"
              className="rounded-full h-9 w-9"
              onClick={() => setTheme("system")}
              title="System theme"
            >
              <Monitor className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div data-testid="text-guideline-badge" className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/20 hover:bg-primary/15 hover:border-primary/30 transition-colors cursor-pointer">
                <ShieldCheck className="w-3.5 h-3.5" />
                CMS CY 2026 Guidelines
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-96 p-0" sideOffset={8}>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-base text-foreground">CMS CY 2026 Home Health Guidelines</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This calculator follows the Centers for Medicare &amp; Medicaid Services (CMS) Calendar Year 2026 Final Rule for Home Health Services.
                </p>
                <div className="space-y-3">
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Certification Period</div>
                    <div className="text-sm font-semibold text-foreground">60 days per 42 CFR §424.22</div>
                    <div className="text-xs text-muted-foreground mt-1">Physician certifies patient for 60 days of home health care (Day 1 = SOC, Day 60 = SOC + 59)</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Payment Model</div>
                    <div className="text-sm font-semibold text-foreground">PDGM — Patient-Driven Groupings Model</div>
                    <div className="text-xs text-muted-foreground mt-1">Each 60-day certification is split into two 30-day payment periods (Period 1: Days 1–30, Period 2: Days 31–60)</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Episode Structure</div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex justify-between"><span>Week boundaries</span><span className="font-semibold text-foreground">Sunday–Saturday</span></div>
                      <div className="flex justify-between"><span>Week 1</span><span className="font-semibold text-foreground">SOC date through Saturday</span></div>
                      <div className="flex justify-between"><span>Final week</span><span className="font-semibold text-foreground">Ends on Day 60</span></div>
                      <div className="flex justify-between"><span>Total weeks</span><span className="font-semibold text-foreground">9–10 (varies by SOC day)</span></div>
                    </div>
                  </div>
                </div>
                <a
                  href="https://www.cms.gov/medicare/payment/prospective-payment-systems/home-health"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  View CMS Home Health PPS page
                </a>
              </div>
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">
            60-day certification · PDGM 30-day payment periods
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: SOC Input & Summary */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  Episode Timeline
                </CardTitle>
                <CardDescription>Enter the patient's SOC date</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="socDate" className="text-sm font-semibold">Start of Care (SOC) Date</Label>
                  <Input 
                    id="socDate" 
                    type="date" 
                    value={socDateStr}
                    onChange={(e) => setSocDateStr(e.target.value)}
                    className="h-12 bg-muted/30 focus-visible:ring-primary"
                  />
                </div>

                {episodeDetails && (
                  <div className="bg-muted/30 rounded-lg p-4 space-y-4 border border-border/50">
                    <div>
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Episode Start (Day 1)</div>
                      <div className="font-semibold text-foreground">
                        {format(episodeDetails.startDate, "EEEE, MMMM d, yyyy")}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Episode End (Day 60)</div>
                      <div className="font-semibold text-foreground">
                        {format(episodeDetails.endDate, "EEEE, MMMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-primary text-primary-foreground">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-primary-foreground">
                  <ClipboardList className="w-5 h-5" />
                  Frequency Order
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-black/10 rounded-lg p-4 font-mono text-lg font-bold text-center border border-white/10 break-words">
                  {generatedFrequencyStr}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-primary-foreground/80 text-sm">
                    Total Visits: <span className="font-bold text-primary-foreground">{totalVisits}</span>
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="bg-white text-primary hover:bg-white/90 font-semibold"
                    onClick={copyToClipboard}
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? "Copied" : "Copy Order"}
                  </Button>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <SavePlanButton
                    currentPlan={{ socDate: socDateStr, frequencyStr: generatedFrequencyStr, visits: derivedVisits, totalVisits }}
                    savedPlans={savedPlans}
                    onSave={handleSavePlan}
                  />
                  {savedPlans.length >= 2 && (
                    <Button
                      data-testid="button-compare-plans"
                      variant="secondary"
                      size="sm"
                      className="bg-white/80 text-primary hover:bg-white/90 font-semibold"
                      onClick={() => setShowComparison(true)}
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Compare
                    </Button>
                  )}
                </div>

                {activeDates.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-primary-foreground/20">
                    <CalendarExport dates={activeDates} episodeDetails={episodeDetails} frequencyStr={generatedFrequencyStr} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Interactive Tabs */}
          <div className="lg:col-span-8">
            <Card className="border-none shadow-md h-full">
              <CardContent className="p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-5 mb-8 h-12">
                    <TabsTrigger value="visual" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <MousePointerClick className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Visual</span>
                    </TabsTrigger>
                    <TabsTrigger value="frequency" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <PenLine className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Frequency</span>
                    </TabsTrigger>
                    <TabsTrigger value="interval" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <CalendarClock className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Interval</span>
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <ClipboardList className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Input</span>
                    </TabsTrigger>
                    <TabsTrigger value="scan" className="text-xs sm:text-sm font-semibold h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Camera className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">EMR Scan</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="frequency" className="mt-0">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-foreground">Frequency Input</h3>
                      <p className="text-sm text-muted-foreground">Enter visit frequency notation to generate a weekly visit plan</p>
                    </div>

                    {episodeDetails ? (
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="frequency-input" className="text-sm font-semibold">Frequency Notation</Label>
                            <Input
                              id="frequency-input"
                              data-testid="input-frequency"
                              type="text"
                              placeholder="e.g., 1W1, 3W8"
                              value={frequencyInput}
                              onChange={(e) => setFrequencyInput(e.target.value)}
                              className="h-12 font-mono text-lg bg-muted/30 focus-visible:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground">
                              Format: <span className="font-mono font-semibold">visits</span>W<span className="font-mono font-semibold">weeks</span> — e.g., "3W2" means 3 visits/week for 2 weeks. Separate segments with commas.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="frequency-total" className="text-sm font-semibold">Expected Total Visits <span className="font-normal text-muted-foreground">(optional cross-check)</span></Label>
                            <Input
                              id="frequency-total"
                              data-testid="input-frequency-total"
                              type="number"
                              min="0"
                              placeholder="e.g., 25"
                              value={frequencyTotalInput}
                              onChange={(e) => setFrequencyTotalInput(e.target.value)}
                              className="h-12 bg-muted/30 focus-visible:ring-primary w-32"
                            />
                          </div>
                        </div>

                        {parsedFrequency && frequencyInput.trim() && (
                          <div className="space-y-4">
                            {parsedFrequency.error && (
                              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                                parsedFrequency.valid
                                  ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                                  : 'bg-red-500/10 text-red-700 border border-red-500/20'
                              }`}>
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {parsedFrequency.error}
                              </div>
                            )}

                            {parsedFrequency.valid && (
                              <>
                                <div className="flex items-center gap-4 flex-wrap">
                                  <div className="bg-muted/30 rounded-lg px-4 py-2 border border-border/50">
                                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Parsed Total</div>
                                    <div className={`font-mono text-xl font-bold ${
                                      frequencyTotalInput && parseInt(frequencyTotalInput) !== parsedFrequency.totalVisits
                                        ? 'text-amber-600'
                                        : 'text-foreground'
                                    }`}>
                                      {parsedFrequency.totalVisits} visits
                                    </div>
                                  </div>
                                  {frequencyTotalInput && (
                                    <div className="flex items-center gap-2">
                                      {parseInt(frequencyTotalInput) === parsedFrequency.totalVisits ? (
                                        <span className="flex items-center gap-1.5 text-sm text-green-600 font-semibold">
                                          <CheckCircle2 className="w-4 h-4" /> Matches expected total
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1.5 text-sm text-amber-600 font-semibold">
                                          <AlertCircle className="w-4 h-4" /> Expected {frequencyTotalInput}, got {parsedFrequency.totalVisits}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <div className="text-sm font-semibold text-foreground">Weekly Distribution Preview</div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                                    {episodeDetails.weeks.map((week, i) => (
                                      <div key={i} className={`rounded-lg border p-3 text-center ${
                                        parsedFrequency.visits[i] > 0
                                          ? 'bg-primary/5 border-primary/20'
                                          : 'bg-muted/20 border-border/50'
                                      }`}>
                                        <div className="text-xs text-muted-foreground font-medium">W{week.weekNumber}</div>
                                        <div className="font-mono text-lg font-bold text-foreground">{parsedFrequency.visits[i]}</div>
                                        <div className="text-[10px] text-muted-foreground">{week.daysInWeek}d · Days {week.dayStart}–{week.dayEnd}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {suggestedDates.length > 0 && episodeDetails && (
                                  <div className="space-y-3">
                                    <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                                      Smart Visit Plan
                                    </div>
                                    <p className="text-xs text-muted-foreground">Visits optimally spaced on weekdays with consistent patterns.</p>
                                    <SmartScheduleRationale rationale={smartSchedule.rationale} />
                                    <div className="bg-card border border-border shadow-sm rounded-xl p-4 inline-block w-full max-w-sm">
                                      <Calendar
                                        mode="multiple"
                                        selected={suggestedDates}
                                        disabled={(date) => {
                                          const normDate = startOfDay(date);
                                          return normDate < startOfDay(episodeDetails.startDate) || normDate > startOfDay(episodeDetails.endDate);
                                        }}
                                        defaultMonth={episodeDetails.startDate}
                                        className="w-full flex justify-center [&_.rdp-day_button]:w-10 [&_.rdp-day_button]:h-10 [&_.rdp-day_button]:text-base"
                                      />
                                    </div>
                                    <CalendarExport dates={suggestedDates} episodeDetails={episodeDetails} frequencyStr={generatedFrequencyStr} />
                                  </div>
                                )}

                                <div className="flex justify-end">
                                  <Button onClick={applyFrequencyInput} className="font-semibold" data-testid="button-apply-frequency">
                                    Apply to Weekly Input
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground">
                        Please enter a valid Start of Care date.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="interval" className="mt-0">
                    <IntervalScheduler episodeDetails={episodeDetails} onApply={handleIntervalApply} />
                  </TabsContent>

                  <TabsContent value="manual" className="mt-0">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-foreground">Weekly Certification Breakdown</h3>
                      <p className="text-sm text-muted-foreground">Allocate prescribed visits per week</p>
                    </div>

                    {episodeDetails ? (
                      <div className="space-y-3">
                        {episodeDetails.weeks.map((week, index) => {
                          const isLastWeek = index === episodeDetails.weeks.length - 1;
                          const prevWeek = index > 0 ? episodeDetails.weeks[index - 1] : null;
                          const showPeriodDivider = prevWeek && prevWeek.dayEnd <= 30 && week.dayStart > 30;
                          return (
                          <div key={index}>
                            {showPeriodDivider && (
                              <div className="flex items-center gap-3 my-4" data-testid="text-payment-period-divider">
                                <div className="flex-1 border-t-2 border-dashed border-primary/30" />
                                <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full whitespace-nowrap">
                                  30-Day Payment Period 2 Begins
                                </span>
                                <div className="flex-1 border-t-2 border-dashed border-primary/30" />
                              </div>
                            )}
                          <div 
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all ${
                              isLastWeek 
                                ? "bg-accent/20 border-accent-foreground/10" 
                                : "bg-card border-border hover:border-primary/30 hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-center gap-4 mb-3 sm:mb-0">
                              <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm ${
                                isLastWeek ? "bg-accent text-accent-foreground" : "bg-primary/10 text-primary"
                              }`}>
                                W{week.weekNumber}
                              </div>
                              <div>
                                <div className="font-semibold text-sm">
                                  {format(week.startDate, "MMM d")} - {format(week.endDate, "MMM d")}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {week.daysInWeek} {week.daysInWeek === 1 ? "day" : "days"} (Days {week.dayStart}-{week.dayEnd})
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <Label htmlFor={`week-${index}`} className="text-sm text-muted-foreground sm:sr-only">
                                Visits
                              </Label>
                              <div className="flex items-center">
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-9 w-9 rounded-r-none border-r-0"
                                  onClick={() => handleVisitChange(index, String(Math.max(0, derivedVisits[index] - 1)))}
                                >
                                  -
                                </Button>
                                <Input 
                                  id={`week-${index}`}
                                  type="number"
                                  min="0"
                                  max="7"
                                  value={derivedVisits[index] || ""}
                                  onChange={(e) => handleVisitChange(index, e.target.value)}
                                  className="w-16 h-9 rounded-none text-center font-semibold focus-visible:z-10"
                                />
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-9 w-9 rounded-l-none border-l-0"
                                  onClick={() => handleVisitChange(index, String(derivedVisits[index] + 1))}
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                          </div>
                          </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground">
                        Please enter a valid Start of Care date.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="visual" className="mt-0 flex flex-col items-center">
                    <div className="w-full mb-6">
                      <h3 className="text-lg font-semibold text-foreground">Select Appointment Dates</h3>
                      <p className="text-sm text-muted-foreground">Click days on the calendar to schedule visits. Frequency will be calculated automatically.</p>
                    </div>

                    {episodeDetails ? (
                      <div className="bg-card border border-border shadow-sm rounded-xl p-4 inline-block w-full max-w-sm">
                        <Calendar
                          mode="multiple"
                          selected={selectedDates}
                          onSelect={(dates) => setSelectedDates(dates as Date[])}
                          disabled={isDateDisabled}
                          defaultMonth={episodeDetails.startDate}
                          className="w-full flex justify-center [&_.rdp-day_button]:w-10 [&_.rdp-day_button]:h-10 [&_.rdp-day_button]:text-base"
                        />
                      </div>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground w-full">
                        Please enter a valid Start of Care date.
                      </div>
                    )}

                    {episodeDetails && selectedDates.length > 0 && (
                       <div className="w-full mt-6 flex justify-end">
                         <Button variant="ghost" onClick={() => setSelectedDates([])} className="text-muted-foreground">
                           Clear Selections
                         </Button>
                       </div>
                    )}
                  </TabsContent>

                  <TabsContent value="scan" className="mt-0">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-foreground">EMR Schedule Scanner</h3>
                      <p className="text-sm text-muted-foreground">Upload a photo of a schedule to automatically detect and verify frequency.</p>
                    </div>

                    <div className="space-y-6">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                      />
                      
                      <div
                        className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                          isScanning ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
                        }`}
                        onClick={() => !isScanning && fileInputRef.current?.click()}
                        data-onboarding="upload-image"
                      >
                        {isScanning ? (
                          <>
                            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                            <h4 className="font-semibold text-lg">Scanning Schedule...</h4>
                            <p className="text-sm text-muted-foreground mt-1">Extracting dates using OCR</p>
                          </>
                        ) : (
                          <>
                            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                              <Camera className="w-8 h-8" />
                            </div>
                            <h4 className="font-semibold text-lg">Tap to upload EMR screenshot</h4>
                            <p className="text-sm text-muted-foreground mt-1">Supports PNG, JPG up to 10MB</p>
                            <Button variant="outline" className="mt-4">
                              <Upload className="w-4 h-4 mr-2" /> Browse Files
                            </Button>
                          </>
                        )}
                      </div>

                      {scanError && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <Card className="border border-red-500/50 bg-red-500/5">
                            <CardContent className="p-6">
                              <div className="flex items-start gap-4">
                                <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-1" />
                                <div>
                                  <h4 className="font-semibold text-lg">Scan Failed</h4>
                                  <p className="text-sm text-muted-foreground mt-1">{scanError}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {scanResult && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <Card className={`border ${scanResult.status === 'success' ? 'border-green-500/50 bg-green-500/5' : 'border-amber-500/50 bg-amber-500/5'}`} data-onboarding="review-visits">
                            <CardContent className="p-6">
                              <div className="flex items-start gap-4">
                                {scanResult.status === 'success' ? (
                                  <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-1" />
                                ) : (
                                  <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                                )}
                                <div className="flex-1">
                                  <h4 className="font-semibold text-lg flex items-center gap-2">
                                    {scanResult.status === 'success' ? 'Schedule Matches' : 'Frequency Mismatch Detected'}
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      scanResult.confidence === 'high' ? 'bg-green-100 text-green-700' :
                                      scanResult.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {scanResult.confidence} confidence
                                    </span>
                                  </h4>

                                  {scanResult.emrSystem && scanResult.emrSystem !== "Unknown" && (
                                    <p className="text-xs text-muted-foreground mt-1">Detected EMR: {scanResult.emrSystem}</p>
                                  )}

                                  {scanResult.notes && (
                                    <p className="text-sm text-muted-foreground mt-2">{scanResult.notes}</p>
                                  )}
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 bg-background/50 rounded-lg p-4 border border-black/5">
                                    {scanResult.detectedSocDate && (
                                      <div>
                                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Detected SOC Date</div>
                                        <div className="font-mono text-lg font-bold">{format(parseISO(scanResult.detectedSocDate), "MM/dd/yyyy")}</div>
                                      </div>
                                    )}
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Detected Frequency</div>
                                      <div className="font-mono text-lg font-bold">{scanResult.detected}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Visits</div>
                                      <div className="font-mono text-lg font-bold">{scanResult.visits.reduce((a, b) => a + b, 0)}</div>
                                    </div>
                                  </div>

                                  <div className="mt-4 flex justify-end">
                                    <Button onClick={applyScannedVisits} className="font-semibold" data-testid="button-apply-scan">
                                      Apply Detected Schedule
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
        </div>

        {episodeDetails && (
          <Timeline episodeDetails={episodeDetails} visits={derivedVisits} visitDates={activeDates.length > 0 ? activeDates : undefined} />
        )}

        {showComparison && savedPlans.length >= 2 && (
          <PlanComparison plans={savedPlans} onRemovePlan={handleRemovePlan} onClose={() => setShowComparison(false)} />
        )}

        <footer className="text-center py-6 mt-8 border-t border-border space-y-2">
          <div className="flex items-center justify-center gap-2">
            <DuckyMascot state="idle" size="sm" />
            <span className="text-sm font-medium text-muted-foreground">{BRANDING.duckyFooter}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {BRANDING.parentCompany}. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
