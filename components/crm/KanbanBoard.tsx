'use client'

import { useState } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay, defaultDropAnimationSideEffects,
  type DragStartEvent, type DragOverEvent, type DragEndEvent, type DropAnimation,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type CRMLead } from '@/lib/twenty'
import { Phone, Mail, MoreHorizontal } from 'lucide-react'

const COLUMNS = [
  { id: 'New',         title: 'New Leads',    color: '#7B5EA7' },
  { id: 'Contacted',   title: 'Contacted',    color: '#4A90D9' },
  { id: 'Qualified',   title: 'Qualified',    color: '#F5A623' },
  { id: 'Negotiation', title: 'Negotiation',  color: '#9B59B6' },
  { id: 'Won',         title: 'Closed Won',   color: '#27AE60' },
  { id: 'Lost',        title: 'Lost',         color: '#8C8C8C' },
]

const getName  = (l: CRMLead) => `${l.name.firstName} ${l.name.lastName}`.trim() || 'Unnamed'
const getPhone = (l: CRMLead) => l.phones.primaryPhoneNumber ?? ''
const getEmail = (l: CRMLead) => l.emails.primaryEmail ?? ''
const getScore = (l: CRMLead) => l.intentScore ?? 0

function scoreDot(score: number) {
  if (score >= 70) return '#FB923C'
  if (score >= 40) return '#F5A623'
  return '#6B7280'
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function SortableLeadCard({ lead }: { lead: CRMLead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id, data: { lead },
  })
  const score = getScore(lead)
  const dot = scoreDot(score)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
      className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm hover:shadow-md group cursor-grab active:cursor-grabbing mb-2 transition-shadow"
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-slate-800 text-sm truncate pr-2">{getName(lead)}</h4>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, boxShadow: `0 0 6px ${dot}`, flexShrink: 0, marginTop: 3 }} />
      </div>

      <div className="space-y-1 mb-2">
        {getPhone(lead) && (
          <div className="flex items-center text-xs text-slate-400">
            <Phone className="w-3 h-3 mr-1.5" />{getPhone(lead)}
          </div>
        )}
        {getEmail(lead) && (
          <div className="flex items-center text-xs text-slate-400 truncate">
            <Mail className="w-3 h-3 mr-1.5" />{getEmail(lead)}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-xs text-slate-400">
          Score: <span style={{ color: dot }} className="font-semibold">{score}</span>
        </span>
        <button className="text-slate-200 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Board ────────────────────────────────────────────────────────────────────
interface KanbanBoardProps {
  leads: CRMLead[]
  onLeadUpdate: (leadId: string, newStatus: string) => void
}

export function KanbanBoard({ leads, onLeadUpdate }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {}
    COLUMNS.forEach(col => {
      map[col.id] = leads
        .filter(l => (l.status ?? 'New') === col.id)
        .map(l => l.id)
    })
    return map
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const findContainer = (id: string) => {
    if (id in items) return id
    return Object.keys(items).find(k => items[k].includes(id))
  }

  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string)

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const fromCol = findContainer(active.id as string)
    const toCol = findContainer(over.id as string) ?? (COLUMNS.find(c => c.id === over.id)?.id)
    if (!fromCol || !toCol || fromCol === toCol) return

    setItems(prev => {
      const fromItems = prev[fromCol]
      const toItems = prev[toCol]
      const fromIdx = fromItems.indexOf(active.id as string)
      const toIdx = toItems.indexOf(over.id as string)
      const below = over && active.rect.current.translated &&
        active.rect.current.translated.top > over.rect.top + over.rect.height
      const newIdx = toIdx >= 0 ? toIdx + (below ? 1 : 0) : toItems.length + 1

      return {
        ...prev,
        [fromCol]: prev[fromCol].filter(id => id !== active.id),
        [toCol]: [...toItems.slice(0, newIdx), fromItems[fromIdx], ...toItems.slice(newIdx)],
      }
    })
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const fromCol = findContainer(active.id as string)
    const toCol = over ? (findContainer(over.id as string) ?? COLUMNS.find(c => c.id === over.id)?.id) : null
    if (fromCol && toCol && fromCol !== toCol) {
      onLeadUpdate(active.id as string, toCol)
    }
    setActiveId(null)
  }

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }),
  }

  return (
    <DndContext
      sensors={sensors} collisionDetection={closestCenter}
      onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
        {COLUMNS.map(col => (
          <div key={col.id} className="flex-shrink-0 w-64 rounded-xl border border-slate-200 flex flex-col" style={{ background: '#F8FAFC' }}>
            <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: col.color }} />
                <h3 className="font-semibold text-slate-700 text-sm">{col.title}</h3>
              </div>
              <span className="text-xs font-medium text-slate-400 bg-white px-1.5 py-0.5 rounded-md border border-slate-200">
                {items[col.id]?.length ?? 0}
              </span>
            </div>
            <div className="p-2 flex-1 overflow-y-auto min-h-[100px]">
              <SortableContext id={col.id} items={items[col.id] ?? []} strategy={verticalListSortingStrategy}>
                <div>
                  {(items[col.id] ?? []).map(id => {
                    const lead = leads.find(l => l.id === id)
                    return lead ? <SortableLeadCard key={id} lead={lead} /> : null
                  })}
                </div>
              </SortableContext>
            </div>
          </div>
        ))}
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeId ? <SortableLeadCard lead={leads.find(l => l.id === activeId)!} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
