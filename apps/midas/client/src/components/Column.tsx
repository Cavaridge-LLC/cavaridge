import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { InitiativeCard, InitiativeType, SortableInitiativeCard } from "./InitiativeCard";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";

interface ColumnProps {
  id: string;
  title: string;
  subtitle: string;
  items: InitiativeType[];
}

export function Column({ id, title, subtitle, items }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id,
  });

  return (
    <div className="flex flex-col w-80 shrink-0">
      <div className="flex items-center justify-between mb-4 px-2">
        <div>
          <h2 className="font-display font-semibold text-lg">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="bg-muted px-2 py-0.5 rounded-full text-xs font-medium text-muted-foreground">
          {items.length}
        </div>
      </div>
      
      <div 
        ref={setNodeRef}
        className="flex-1 flex flex-col gap-3 p-3 bg-muted/30 border border-border/50 rounded-xl min-h-[300px]"
      >
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableInitiativeCard key={item.id} item={item} />
          ))}
        </SortableContext>
        
        <Button variant="ghost" className="mt-2 w-full justify-start text-muted-foreground hover:text-foreground border border-dashed border-transparent hover:border-border hover:bg-card/50 h-10">
          <Plus className="w-4 h-4 mr-2" />
          Add Initiative
        </Button>
      </div>
    </div>
  );
}
