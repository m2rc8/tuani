'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '../../../../lib/api'
import { getToken, getRole } from '../../../../lib/auth'
import { getSocket, disconnectSocket } from '../../../../lib/socket'
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
} from 'agora-rtc-sdk-ng'

/* ─── Types ─────────────────────────────────────────────── */
interface Message {
  id:         string
  sender_id:  string
  content:    string
  created_at: string
}

interface Consultation {
  id:             string
  status:         'pending' | 'active' | 'completed'
  price_lps:      number | null
  payment_status: 'pending' | 'confirmed' | null
  symptoms_text:  string | null
  symptom_photo:  string | null
  messages:       Message[]
  doctor_id:      string
}

/* ─── Helpers ────────────────────────────────────────────── */
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
}

/* ─── Component ──────────────────────────────────────────── */
export default function ConsultationPage() {
  const { id }      = useParams<{ id: string }>()
  const router      = useRouter()

  const [consult, setConsult]     = useState<Consultation | null>(null)
  const [messages, setMessages]   = useState<Message[]>([])
  const [loading, setLoading]     = useState(true)
  const [msgInput, setMsgInput]   = useState('')
  const [sending, setSending]     = useState(false)
  const [payLoading, setPayLoad]  = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Video call state
  const [inCall, setInCall]       = useState(false)
  const [callLoading, setCallLoad] = useState(false)
  const localVideoRef  = useRef<HTMLDivElement>(null)
  const remoteVideoRef = useRef<HTMLDivElement>(null)
  const agoraClient    = useRef<IAgoraRTCClient | null>(null)
  const localTracks    = useRef<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socketRef      = useRef(false)
  const myId           = useRef<string | null>(null)

  // Role guard
  useEffect(() => {
    if (getRole() !== 'doctor') router.replace('/')
  }, [router])

  // Load consultation
  const loadConsult = useCallback(async () => {
    try {
      const data = await apiFetch<Consultation>(`/api/consultations/${id}`)
      setConsult(data)
      setMessages(data.messages ?? [])
      myId.current = data.doctor_id
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadConsult() }, [loadConsult])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Socket.io
  useEffect(() => {
    const token = getToken()
    if (!token || socketRef.current) return
    socketRef.current = true

    const sock = getSocket(token)
    sock.emit('join_consultation', { consultationId: id })

    sock.on('receive_message', (msg: Message) => {
      setMessages(prev => [...prev, msg])
    })

    sock.on('consultation_updated', (data: Partial<Consultation>) => {
      setConsult(prev => prev ? { ...prev, ...data } : prev)
    })

    return () => {
      sock.off('receive_message')
      sock.off('consultation_updated')
      disconnectSocket()
      socketRef.current = false
    }
  }, [id])

  // Send message
  async function sendMessage() {
    if (!msgInput.trim() || sending) return
    setSending(true)
    try {
      await apiFetch(`/api/consultations/${id}/message`, {
        method: 'POST',
        body: JSON.stringify({ content: msgInput.trim() }),
      })
      setMsgInput('')
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  // Confirm payment
  async function confirmPayment() {
    setPayLoad(true)
    try {
      await apiFetch(`/api/consultations/${id}/payment`, { method: 'PUT' })
      setConsult(prev => prev ? { ...prev, payment_status: 'confirmed' } : prev)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setPayLoad(false)
    }
  }

  // ── Video call ───────────────────────────────────────────
  async function startVideoCall() {
    setCallLoad(true)
    try {
      const { token: agoraToken, channel, uid, appId } =
        await apiFetch<{ token: string; channel: string; uid: number; appId: string }>(
          `/api/consultations/${id}/video-token`,
          { method: 'POST' }
        )

      const sock = getSocket(getToken()!)
      sock.emit('video_call_invite', { consultationId: id })

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
      agoraClient.current = client

      await client.join(appId, channel, agoraToken, uid)

      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks()
      localTracks.current = [audioTrack, videoTrack]

      if (localVideoRef.current) {
        videoTrack.play(localVideoRef.current)
      }

      await client.publish([audioTrack, videoTrack])

      client.on('user-published', async (remoteUser, mediaType) => {
        await client.subscribe(remoteUser, mediaType)
        if (mediaType === 'video') {
          const remoteVideo = remoteUser.videoTrack as IRemoteVideoTrack
          if (remoteVideoRef.current) remoteVideo.play(remoteVideoRef.current)
        }
        if (mediaType === 'audio') {
          const remoteAudio = remoteUser.audioTrack as IRemoteAudioTrack
          remoteAudio.play()
        }
      })

      setInCall(true)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setCallLoad(false)
    }
  }

  async function endVideoCall() {
    localTracks.current?.[0].stop()
    localTracks.current?.[0].close()
    localTracks.current?.[1].stop()
    localTracks.current?.[1].close()
    localTracks.current = null
    await agoraClient.current?.leave()
    agoraClient.current = null
    setInCall(false)
  }

  /* ─── Render ──────────────────────────────────────────── */
  if (loading) return <p className="text-slate-500 text-sm">Cargando consulta...</p>
  if (error)   return <p className="text-red-400 text-sm">{error}</p>
  if (!consult) return null

  const isCompleted    = consult.status === 'completed'
  const payPending     = isCompleted && consult.payment_status === 'pending'
  const payConfirmed   = isCompleted && consult.payment_status === 'confirmed'

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/doctor/queue')}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-bold">Consulta #{id.slice(0, 8)}</h1>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
            isCompleted ? 'bg-green-900 text-green-300' :
            consult.status === 'active' ? 'bg-blue-900 text-blue-300' :
            'bg-yellow-900 text-yellow-300'
          }`}>
            {isCompleted ? 'Completada' : consult.status === 'active' ? 'Activa' : 'Pendiente'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Video call button */}
          {!isCompleted && (
            <button
              onClick={startVideoCall}
              disabled={callLoading || inCall}
              className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors bg-teal-700 hover:bg-teal-600 text-white disabled:opacity-50"
            >
              {callLoading ? 'Conectando...' : inCall ? 'En llamada' : '📹 Videollamada'}
            </button>
          )}

          {/* Complete consultation */}
          {!isCompleted && (
            <button
              onClick={() => router.push(`/doctor/consultation/${id}/rx`)}
              className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors bg-green-600 hover:bg-green-700 text-white"
            >
              Completar consulta
            </button>
          )}

          {/* Confirm payment */}
          {payPending && (
            <button
              onClick={confirmPayment}
              disabled={payLoading}
              className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
            >
              {payLoading ? 'Procesando...' : `Confirmar pago L.${consult.price_lps ?? 0}`}
            </button>
          )}

          {payConfirmed && (
            <span className="text-green-400 font-semibold text-sm">Pago confirmado ✓</span>
          )}
        </div>
      </div>

      {/* ── Symptoms card ── */}
      {(consult.symptoms_text || consult.symptom_photo) && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-4 shrink-0">
          <p className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">Motivo de consulta</p>
          {consult.symptoms_text && (
            <p className="text-slate-200 text-sm">{consult.symptoms_text}</p>
          )}
          {consult.symptom_photo && (
            <div className="mt-2">
              <a href={consult.symptom_photo} target="_blank" rel="noreferrer">
                <img
                  src={consult.symptom_photo}
                  alt="Foto de síntoma"
                  className="max-h-40 rounded border border-slate-600 object-cover"
                />
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Chat ── */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-4 min-h-0">
        {messages.length === 0 ? (
          <p className="text-slate-600 text-sm text-center mt-8">Aún no hay mensajes</p>
        ) : (
          messages.map(msg => {
            const mine = msg.sender_id === myId.current
            return (
              <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-lg px-4 py-2 text-sm ${
                  mine
                    ? 'bg-sky-700 text-white rounded-br-none'
                    : 'bg-slate-700 text-slate-200 rounded-bl-none'
                }`}>
                  <p>{msg.content}</p>
                  <p className={`text-xs mt-1 ${mine ? 'text-sky-300' : 'text-slate-500'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Message input ── */}
      <div className="flex gap-2 shrink-0">
        <input
          type="text"
          value={msgInput}
          onChange={e => setMsgInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          disabled={isCompleted}
          placeholder={isCompleted ? 'Consulta completada' : 'Escribe un mensaje...'}
          className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={sendMessage}
          disabled={isCompleted || sending || !msgInput.trim()}
          className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50 shrink-0"
        >
          {sending ? '...' : 'Enviar'}
        </button>
      </div>

      {/* ── Video call overlay ── */}
      {inCall && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Remote video (full screen) */}
          <div ref={remoteVideoRef} className="flex-1 bg-slate-900" />

          {/* Local video (picture-in-picture) */}
          <div
            ref={localVideoRef}
            className="absolute bottom-24 right-4 w-40 h-28 bg-slate-800 rounded-lg border border-slate-600 overflow-hidden"
          />

          {/* End call */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <button
              onClick={endVideoCall}
              className="px-8 py-3 rounded-full font-semibold text-sm bg-red-700 hover:bg-red-800 text-white transition-colors"
            >
              Terminar llamada
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
