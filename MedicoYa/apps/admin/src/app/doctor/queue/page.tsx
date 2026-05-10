'use client'
import { useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../../lib/api'
import { getToken, getRole } from '../../../lib/auth'
import { getSocket, disconnectSocket } from '../../../lib/socket'

interface QueueItem {
  id:             string
  patient_name:   string
  symptoms_text:  string | null
  created_at:     string
  symptom_photo?: string | null
}

function waitingMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
}

export default function DoctorQueuePage() {
  const router      = useRouter()
  const queryClient = useQueryClient()
  const socketRef   = useRef(false)

  useEffect(() => {
    if (getRole() !== 'doctor') router.replace('/')
  }, [router])

  const { data = [], isLoading, isError } = useQuery<QueueItem[]>({
    queryKey:        ['doctor-queue'],
    queryFn:         () => apiFetch('/api/consultations/queue'),
    refetchInterval: 30_000,
  })

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['doctor-queue'] })
  }, [queryClient])

  // Socket.io: listen for real-time updates
  useEffect(() => {
    const token = getToken()
    if (!token || socketRef.current) return
    socketRef.current = true

    const sock = getSocket(token)
    sock.on('consultation_updated', (payload: { status?: string }) => {
      if (payload?.status) refresh()
    })

    return () => {
      sock.off('consultation_updated')
      disconnectSocket()
      socketRef.current = false
    }
  }, [refresh])

  async function handleAccept(id: string) {
    try {
      await apiFetch(`/api/consultations/${id}/accept`, { method: 'PUT' })
      router.push(`/doctor/consultation/${id}`)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  async function handleReject(id: string) {
    try {
      await apiFetch(`/api/consultations/${id}/reject`, { method: 'PUT' })
      refresh()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Cola de consultas</h1>
        <button
          onClick={refresh}
          className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors bg-slate-700 hover:bg-slate-600 text-slate-200"
        >
          Actualizar
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500 text-sm">Cargando cola...</p>
      ) : isError ? (
        <p className="text-red-400 text-sm">Error al cargar la cola.</p>
      ) : data.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
          <p className="text-slate-400 text-lg">No hay consultas pendientes</p>
          <p className="text-slate-600 text-sm mt-1">La cola se actualiza automáticamente cada 30 segundos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map(item => {
            const minutes  = waitingMinutes(item.created_at)
            const symptoms = item.symptoms_text
              ? item.symptoms_text.slice(0, 80) + (item.symptoms_text.length > 80 ? '…' : '')
              : null

            return (
              <div
                key={item.id}
                className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex items-center gap-4"
              >
                {/* Avatar placeholder */}
                <div className="w-10 h-10 rounded-full bg-sky-900 flex items-center justify-center shrink-0 text-sky-300 font-bold text-lg">
                  {item.patient_name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{item.patient_name}</p>
                  {symptoms ? (
                    <p className="text-slate-400 text-sm mt-0.5 truncate">{symptoms}</p>
                  ) : (
                    <p className="text-slate-600 text-sm mt-0.5 italic">Sin descripción de síntomas</p>
                  )}
                </div>

                {/* Waiting time */}
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-500">Espera</p>
                  <p className={`font-bold text-sm ${minutes >= 10 ? 'text-red-400' : minutes >= 5 ? 'text-amber-400' : 'text-green-400'}`}>
                    {minutes} min
                  </p>
                </div>

                {/* Photo indicator */}
                {item.symptom_photo && (
                  <span className="shrink-0 text-xs bg-sky-900 text-sky-300 px-2 py-0.5 rounded">
                    📷 Foto
                  </span>
                )}

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleAccept(item.id)}
                    className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors bg-green-600 hover:bg-green-700 text-white"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors bg-red-700 hover:bg-red-800 text-white"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
