import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { GripVertical, MoreVertical, DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type InitiativeType = {
  id: string;
  title: string;
  description: string;
  team: string;
  priority: string;
  status: string;
  cost?: string;
  businessProblem?: string;
};

interface InitiativeCardProps {
  item: InitiativeType;
  isDragging?: boolean;
}

const TEAM_COLORS: Record<string, string> = {
  "Infrastructure": "bg-blue-500",
  "Cloud": "bg-purple-500",
  "Security": "bg-red-500",
  "Strategy": "bg-amber-500"
};

const PRIORITY_STYLES: Record<string, string> = {
  "Critical": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-900",
  "High": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-900",
  "Medium": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  "Low": "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  "Planned": <Clock className="w-3.5 h-3.5 text-slate-500" />,
  "In Progress": <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />,
  "Completed": <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  "Proposed": <div className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-slate-400" />
};

export function InitiativeCard({ item, isDragging }: InitiativeCardProps) {
  const teamColor = TEAM_COLORS[item.team] || "bg-slate-500";
  const priorityStyle = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES["Low"];

  return (
    <Card 
      className={cn(
        "group relative flex flex-col p-4 cursor-grab active:cursor-grabbing border bg-card transition-all duration-200 hover:shadow-md hover:border-primary/30 overflow-hidden",
        isDragging && "opacity-50 ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      {/* Team Color Accent Bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", teamColor)} />

      <div className="flex justify-between items-start mb-2 pl-2">
        <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0 h-5", priorityStyle)}>
          {item.priority}
        </Badge>
        <button className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      <div className="pl-2">
        <h3 className="font-display font-semibold text-sm leading-snug mb-1.5 text-foreground group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
          {item.description}
        </p>
        
        {item.businessProblem && (
          <div className="mt-2 mb-3 bg-primary/5 border border-primary/10 rounded-md p-2">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-0.5">Business Problem</p>
            <p className="text-xs text-foreground/80 leading-snug">{item.businessProblem}</p>
          </div>
        )}
      </div>

      <div className="mt-auto pt-3 border-t border-border flex items-center justify-between pl-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
          {STATUS_ICONS[item.status]}
          <span>{item.status}</span>
        </div>
        
        {item.cost && (
          <div className="flex items-center text-xs font-semibold text-slate-600 dark:text-slate-400">
            {item.cost}
          </div>
        )}
      </div>
    </Card>
  );
}

export function SortableInitiativeCard({ item }: { item: InitiativeType }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <InitiativeCard item={item} isDragging={isDragging} />
    </div>
  );
}
