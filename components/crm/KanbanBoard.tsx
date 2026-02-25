'use client'

import { useState } from 'react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    DropAnimation,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Lead } from '@/lib/supabase'
import { User, Phone, Mail, Clock, MoreHorizontal } from 'lucide-react'

// Types
type BoardColumn = {
    id: string
    title: string
    color: string
}

const COLUMNS: BoardColumn[] = [
    { id: 'new', title: 'New Leads', color: 'bg-[#7B5EA7]' },
    { id: 'contacted', title: 'Contacted', color: 'bg-[#4A90D9]' },
    { id: 'warm', title: 'Qualified', color: 'bg-[#F5A623]' },
    { id: 'negotiation', title: 'Negotiation', color: 'bg-[#9B59B6]' },
    { id: 'won', title: 'Closed Won', color: 'bg-[#27AE60]' },
    { id: 'lost', title: 'Lost', color: 'bg-[#8C8C8C]' },
]

interface KanbanBoardProps {
    leads: Lead[]
    onLeadUpdate: (leadId: string, newStatus: string) => void
}

// Card Component
function SortableLeadCard({ lead }: { lead: Lead }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: lead.id, data: { lead } })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md group cursor-grab active:cursor-grabbing mb-2 transition-shadow`}
        >
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-gray-900 text-sm truncate pr-2">{lead.name}</h4>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${lead.intent_score >= 70 ? 'bg-[#E04F5F]' : lead.intent_score >= 40 ? 'bg-[#F5A623]' : 'bg-gray-300'}`} />
            </div>

            <div className="space-y-1 mb-2">
                {lead.phone && (
                    <div className="flex items-center text-xs text-gray-500">
                        <Phone className="w-3 h-3 mr-1.5 text-gray-400" />
                        {lead.phone}
                    </div>
                )}
                {lead.email && (
                    <div className="flex items-center text-xs text-gray-500 truncate">
                        <Mail className="w-3 h-3 mr-1.5 text-gray-400" />
                        {lead.email}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                    Score: <span className={`font-medium ${lead.intent_score >= 70 ? 'text-[#E04F5F]' : lead.intent_score >= 40 ? 'text-[#F5A623]' : 'text-gray-500'}`}>{lead.intent_score}</span>
                </span>
                <button className="text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}

export function KanbanBoard({ leads, onLeadUpdate }: KanbanBoardProps) {
    const [activeId, setActiveId] = useState<string | null>(null)
    const [items, setItems] = useState<Record<string, string[]>>(() => {
        const initialItems: Record<string, string[]> = {}
        COLUMNS.forEach(col => {
            initialItems[col.id] = leads
                .filter(l => (l.status?.toLowerCase() || 'new') === col.id)
                .map(l => l.id)
        })
        return initialItems
    })

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5
            }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event
        setActiveId(active.id as string)
    }

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        const activeContainer = findContainer(activeId)
        const overContainer = findContainer(overId) || (COLUMNS.find(c => c.id === overId)?.id)

        if (
            !activeContainer ||
            !overContainer ||
            activeContainer === overContainer
        ) {
            return
        }

        setItems((prev) => {
            const activeItems = prev[activeContainer]
            const overItems = prev[overContainer]
            const activeIndex = activeItems.indexOf(activeId)
            const overIndex = overItems.indexOf(overId)

            let newIndex
            if (overId in prev) {
                newIndex = overItems.length + 1
            } else {
                const isBelowOverItem =
                    over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top >
                    over.rect.top + over.rect.height
                const modifier = isBelowOverItem ? 1 : 0
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1
            }

            return {
                ...prev,
                [activeContainer]: [
                    ...prev[activeContainer].filter((item) => item !== activeId),
                ],
                [overContainer]: [
                    ...prev[overContainer].slice(0, newIndex),
                    activeItems[activeIndex],
                    ...prev[overContainer].slice(newIndex, overItems.length),
                ],
            }
        })
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        const activeId = active.id as string
        const overId = over ? (over.id as string) : null

        const activeContainer = findContainer(activeId)
        const overContainer = overId ? (findContainer(overId) || (COLUMNS.find(c => c.id === overId)?.id)) : null

        if (
            activeContainer &&
            overContainer &&
            activeContainer !== overContainer
        ) {
            onLeadUpdate(activeId, overContainer)
        }

        setActiveId(null)
    }

    const findContainer = (id: string) => {
        if (id in items) return id
        return Object.keys(items).find((key) => items[key].includes(id))
    }

    const dropAnimation: DropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-3 overflow-x-auto pb-4 h-[calc(100vh-200px)] min-h-[500px]">
                {COLUMNS.map((column) => (
                    <div
                        key={column.id}
                        className="flex-shrink-0 w-68 bg-gray-50 rounded-lg border border-gray-200 flex flex-col"
                    >
                        {/* Column Header */}
                        <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${column.color}`} />
                                <h3 className="font-medium text-gray-700 text-sm">{column.title}</h3>
                            </div>
                            <span className="text-xs font-medium text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                                {items[column.id]?.length || 0}
                            </span>
                        </div>

                        {/* Column Content */}
                        <div className="p-2 flex-1 overflow-y-auto min-h-[100px]">
                            <SortableContext
                                id={column.id}
                                items={items[column.id] || []}
                                strategy={verticalListSortingStrategy}
                            >
                                <div ref={(node) => { }}>
                                    {(items[column.id] || []).map((leadId) => {
                                        const lead = leads.find(l => l.id === leadId)
                                        if (!lead) return null
                                        return <SortableLeadCard key={lead.id} lead={lead} />
                                    })}
                                </div>
                            </SortableContext>
                        </div>
                    </div>
                ))}
            </div>

            <DragOverlay dropAnimation={dropAnimation}>
                {activeId ? (
                    <SortableLeadCard lead={leads.find(l => l.id === activeId)!} />
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}
