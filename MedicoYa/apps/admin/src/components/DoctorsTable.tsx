'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiFetch } from '../lib/api'

interface DoctorUser { name: string | null; phone: string }
interface Doctor {
  id: string; cedula: string | null; available: boolean
  approved_at: string | null; user: DoctorUser
}

export default function DoctorsTable() {
  const [tab, setTab] = useState<'pending' | 'approved'>('pending')
  const qc = useQueryClient()

  const { data: pending = [], isLoading: loadingPending } = useQuery<Doctor[]>({
    queryKey: ['doctors', 'pending'],
    queryFn:  () => apiFetch('/api/admin/doctors/pending'),
    enabled:  tab === 'pending',
  })

  const { data: approved = [], isLoading: loadingApproved } = useQuery<Doctor[]>({
    queryKey: ['doctors', 'approved'],
    queryFn:  () => apiFetch('/api/admin/doctors/approved'),
    enabled:  tab === 'approved',
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/doctors/${id}/approve`, { method: 'PUT' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/doctors/${id}/reject`, { method: 'PUT' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  })

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            tab === 'pending' ? 'bg-sky-500 text-white' : 'border border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          Pendientes ({pending.length})
        </button>
        <button
          onClick={() => setTab('approved')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            tab === 'approved' ? 'bg-sky-500 text-white' : 'border border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          Activos
        </button>
      </div>

      {tab === 'pending' && (
        loadingPending ? (
          <p className="text-slate-500">Cargando...</p>
        ) : pending.length === 0 ? (
          <p className="text-slate-500">No hay médicos pendientes.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map(doc => (
              <div key={doc.id} className="bg-slate-900 rounded-lg p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{doc.user.name ?? 'Sin nombre'}</p>
                  <p className="text-slate-400 text-sm">
                    Cédula: {doc.cedula ?? '—'} · {doc.user.phone}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => approveMutation.mutate(doc.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded transition-colors"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(doc.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded transition-colors"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'approved' && (
        loadingApproved ? (
          <p className="text-slate-500">Cargando...</p>
        ) : approved.length === 0 ? (
          <p className="text-slate-500">No hay médicos activos.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {approved.map(doc => (
              <div key={doc.id} className="bg-slate-900 rounded-lg p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{doc.user.name ?? 'Sin nombre'}</p>
                  <p className="text-slate-400 text-sm">
                    Cédula: {doc.cedula ?? '—'} · {doc.user.phone}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  doc.available ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-400'
                }`}>
                  {doc.available ? 'Disponible' : 'No disponible'}
                </span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
