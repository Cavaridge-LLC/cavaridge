import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Column } from "./Column";
import { InitiativeCard, type InitiativeType } from "./InitiativeCard";
import { useReorderInitiatives } from "@/lib/api";
import type { Initiative } from "@shared/schema";

const QUARTERS = [
  { id: "Q1 2024", title: "Q1 2024", subtitle: "Jan - Mar" },
  { id: "Q2 2024", title: "Q2 2024", subtitle: "Apr - Jun" },
  { id: "Q3 2024", title: "Q3 2024", subtitle: "Jul - Sep" },
  { id: "Q4 2024", title: "Q4 2024", subtitle: "Oct - Dec" },
];

function toCardItem(init: Initiative): InitiativeType {
  return {
    id: init.id,
    title: init.title,
    description: init.description,
    team: init.team,
    priority: init.priority,
    status: init.status,
    cost: init.cost ?? undefined,
    businessProblem: init.businessProblem ?? undefined,
  };
}

export function RoadmapBoard({ initiatives }: { initiatives: Initiative[] }) {
  const reorder = useReorderInitiatives();

  const initialColumns = useMemo(() => {
    const cols: Record<string, InitiativeType[]> = {};
    for (const q of QUARTERS) cols[q.id] = [];
    for (const init of initiatives) {
      const card = toCardItem(init);
      if (cols[init.quarter]) {
        cols[init.quarter].push(card);
      }
    }
    return cols;
  }, [initiatives]);

  const [columns, setColumns] = useState(initialColumns);
  const [activeItem, setActiveItem] = useState<InitiativeType | null>(null);

  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findContainer = (id: string) => {
    if (id in columns) return id;
    return Object.keys(columns).find((key) => columns[key].find((item) => item.id === id));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    const container = findContainer(id);
    if (container) {
      const item = columns[container].find((i) => i.id === id);
      if (item) setActiveItem(item);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const overId = over?.id;
    if (!overId) return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(overId as string);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setColumns((prev) => {
      const activeItems = prev[activeContainer];
      const activeIndex = activeItems.findIndex((i) => i.id === active.id);
      const overIndex = overId in prev
        ? prev[overContainer].length
        : prev[overContainer].findIndex((i) => i.id === overId);

      return {
        ...prev,
        [activeContainer]: prev[activeContainer].filter((item) => item.id !== active.id),
        [overContainer]: [
          ...prev[overContainer].slice(0, overIndex),
          activeItems[activeIndex],
          ...prev[overContainer].slice(overIndex),
        ],
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over?.id as string);

    if (activeContainer && overContainer && activeContainer === overContainer) {
      const activeIndex = columns[activeContainer].findIndex((i) => i.id === active.id);
      const overIndex = columns[overContainer].findIndex((i) => i.id === over?.id);
      if (activeIndex !== overIndex) {
        setColumns((cols) => ({
          ...cols,
          [overContainer]: arrayMove(cols[overContainer], activeIndex, overIndex),
        }));
      }
    }

    // Persist reorder
    setTimeout(() => {
      setColumns((current) => {
        const updates: { id: string; quarter: string; sortOrder: number }[] = [];
        for (const [quarter, items] of Object.entries(current)) {
          items.forEach((item, idx) => {
            updates.push({ id: item.id, quarter, sortOrder: idx });
          });
        }
        reorder.mutate(updates);
        return current;
      });
    }, 0);

    setActiveItem(null);
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
  };

  return (
    <div className="flex h-full gap-6 pb-4 pt-2 w-max min-w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {QUARTERS.map((quarter) => (
          <Column
            key={quarter.id}
            id={quarter.id}
            title={quarter.title}
            subtitle={quarter.subtitle}
            items={columns[quarter.id] || []}
          />
        ))}

        <DragOverlay dropAnimation={dropAnimation}>
          {activeItem ? (
            <div className="opacity-90 scale-105 rotate-2 cursor-grabbing shadow-2xl">
              <InitiativeCard item={activeItem} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
