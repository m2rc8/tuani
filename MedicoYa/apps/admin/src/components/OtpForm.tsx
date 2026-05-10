'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setToken, setRole } from '../lib/auth'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function OtpForm() {
  const [phone,   setPhone]   = useState('')
  const [code,    setCode]    = useState('')
  const [step,    setStep]    = useState<'phone' | 'code'>('phone')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function sendOtp() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/auth/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Error al enviar código'); return }
      setStep('code')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/auth/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone, code }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Código inválido'); return }
      const role = body.user?.role
      if (role !== 'admin' && role !== 'coordinator' && role !== 'doctor') {
        setError('Acceso denegado.')
        return
      }
      setToken(body.token)
      setRole(role as 'admin' | 'coordinator' | 'doctor')
      if (role === 'coordinator') router.replace('/brigades')
      else if (role === 'doctor') router.replace('/doctor/queue')
      else router.replace('/doctors')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-900 rounded-lg p-6 flex flex-col gap-4">
      {step === 'phone' ? (
        <>
          <label className="text-sm text-slate-400">Número de teléfono</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendOtp()}
            placeholder="+50499000000"
            className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <button
            onClick={sendOtp}
            disabled={loading || !phone.trim()}
            className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded px-4 py-2 font-medium transition-colors"
          >
            {loading ? 'Enviando...' : 'Enviar código'}
          </button>
        </>
      ) : (
        <>
          <label className="text-sm text-slate-400">Código OTP (6 dígitos)</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && code.length === 6 && verifyOtp()}
            placeholder="123456"
            className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 tracking-widest focus:outline-none focus:border-sky-500"
          />
          <button
            onClick={verifyOtp}
            disabled={loading || code.length !== 6}
            className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded px-4 py-2 font-medium transition-colors"
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>
          <button
            onClick={() => { setStep('phone'); setCode('') }}
            className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
          >
            ← Cambiar teléfono
          </button>
        </>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
