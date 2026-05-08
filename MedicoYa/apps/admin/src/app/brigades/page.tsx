'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api'
import { getRole } from '../../lib/auth'

interface Brigade {
  id: string
  name: string
  community: string
  status: string
  join_code: string
}

export default function BrigadesPage() {
  const router = useRouter()
  useEffect(() => {
    if (getRole() !== 'coordinator') router.replace('/doctors')
  }, [router])

  const qc = useQueryClient()
  const [name,      setName]      = useState('')
  const [community, setCommunity] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [joinCode,  setJoinCode]  = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  const { data: brigades = [], isLoading } = useQuery<Brigade[]>({
    queryKey: ['brigades', 'mine'],
    queryFn:  () => apiFetch('/api/brigades/mine'),
  })

  const createMutation = useMutation({
    mutationFn: (body: { name: string; community: string; start_date: string; end_date: string }) =>
      apiFetch<{ id: string; join_code: string }>('/api/brigades', {
        method: 'POST',
        body:   JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['brigades', 'mine'] })
      setJoinCode(data.join_code)
      setName(''); setCommunity(''); setStartDate(''); setEndDate('')
      setFormError('')
    },
    onError: (err: unknown) => setFormError(err instanceof Error ? err.message : 'Error desconocido'),
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !community.trim() || !startDate || !endDate) {
      setFormError('Todos los campos son requeridos.')
      return
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setFormError('La fecha de fin debe ser posterior al inicio.')
      return
    }
    setFormError('')
    createMutation.mutate({
      name:       name.trim(),
      community:  community.trim(),
      start_date: new Date(startDate).toISOString(),
      end_date:   new Date(endDate).toISOString(),
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🚑 Mis Brigadas</h1>

      {/* Brigade list */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Brigadas</h2>
        {isLoading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : brigades.length === 0 ? (
          <p className="text-slate-500 text-sm">No tienes brigadas aún.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {brigades.map(b => (
              <div key={b.id} className="bg-slate-900 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-slate-400 text-sm">{b.community}</p>
                  <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                    b.status === 'active'
                      ? 'bg-green-900 text-green-300'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {b.status === 'active' ? '● activa' : '● cerrada'}
                  </span>
                </div>
                <Link
                  href={`/brigades/detail?id=${b.id}`}
                  className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded transition-colors shrink-0"
                >
                  Ver →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create form */}
      <section className="border-t border-slate-800 pt-6">
        <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-4">Nueva brigada</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3 max-w-md">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre *"
            className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <input
            value={community}
            onChange={e => setCommunity(e.target.value)}
            placeholder="Comunidad *"
            className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Inicio *</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Fin *</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded px-4 py-2 font-medium transition-colors"
          >
            {createMutation.isPending ? 'Creando...' : 'Crear brigada'}
          </button>
        </form>

        {joinCode && (
          <div className="mt-4 max-w-md bg-slate-900 border border-green-600 rounded-lg p-4">
            <p className="text-green-400 text-sm mb-2">✓ Brigada creada — código de acceso:</p>
            <p className="text-4xl font-bold text-white tracking-widest text-center py-2">{joinCode}</p>
            <p className="text-slate-500 text-xs text-center mt-1">Comparte este código con los médicos</p>
          </div>
        )}
      </section>
    </div>
  )
}
