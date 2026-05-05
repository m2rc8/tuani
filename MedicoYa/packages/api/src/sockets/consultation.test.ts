import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { io as ioc, Socket as ClientSocket } from 'socket.io-client'
import { AddressInfo } from 'net'
import jwt from 'jsonwebtoken'
import { registerConsultationHandlers } from './consultation'
import { Role, Language, MessageType, ConsultationStatus, PaymentStatus } from '@prisma/client'

const SECRET   = 'test-secret-medicoya-min-32-chars-ok'
const PAT_ID   = 'patient-uuid-1'
const DOC_ID   = 'doctor-uuid-1'
const CONSULT_ID = 'consult-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockConsultation = {
  id: CONSULT_ID, patient_id: PAT_ID, doctor_id: DOC_ID,
  status: ConsultationStatus.active,
}

const mockMessage = {
  id: 'msg-1', consultation_id: CONSULT_ID, sender_id: PAT_ID,
  content: 'Hello doc', msg_type: MessageType.text, created_at: new Date(),
}

const mockDb = {
  consultation: { findUnique: vi.fn() },
  message:      { create:     vi.fn() },
}

let ioServer: Server
let port: number
const clients: ClientSocket[] = []

beforeAll(async () => {
  const httpServer = createServer()
  ioServer = new Server(httpServer)
  registerConsultationHandlers(ioServer, mockDb as any)
  await new Promise<void>(resolve => httpServer.listen(0, resolve))
  port = (httpServer.address() as AddressInfo).port
})

afterAll(() => {
  clients.forEach(c => c.disconnect())
  ioServer.close()
})

afterEach(() => {
  vi.clearAllMocks()
  clients.forEach(c => c.disconnect())
  clients.length = 0
})

function connect(token?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const opts = token ? { auth: { token } } : {}
    const client = ioc(`http://localhost:${port}`, { ...opts, reconnection: false })
    clients.push(client)
    client.on('connect', () => resolve(client))
    client.on('connect_error', reject)
  })
}

describe('Socket.io authentication', () => {
  it('rejects connection without token', async () => {
    await expect(connect()).rejects.toThrow('UNAUTHORIZED')
  })

  it('rejects connection with invalid token', async () => {
    await expect(connect('bad-token')).rejects.toThrow('UNAUTHORIZED')
  })

  it('accepts connection with valid JWT', async () => {
    const client = await connect(makeToken(PAT_ID, Role.patient))
    expect(client.connected).toBe(true)
  })
})

describe('join_consultation', () => {
  it('allows patient to join their consultation', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...mockConsultation })
    const client = await connect(makeToken(PAT_ID, Role.patient))

    await new Promise<void>((resolve, reject) => {
      client.emit('join_consultation', { consultation_id: CONSULT_ID })
      client.on('error', reject)
      setTimeout(resolve, 100)
    })
  })

  it('emits error when user is not participant', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...mockConsultation })
    const client = await connect(makeToken('other-user', Role.patient))

    const errorCode = await new Promise<string>((resolve) => {
      client.on('error', (err: { code: string }) => resolve(err.code))
      client.emit('join_consultation', { consultation_id: CONSULT_ID })
    })
    expect(errorCode).toBe('NOT_PARTICIPANT')
  })

  it('emits error when consultation does not exist', async () => {
    mockDb.consultation.findUnique.mockResolvedValue(null)
    const client = await connect(makeToken(PAT_ID, Role.patient))

    const errorCode = await new Promise<string>((resolve) => {
      client.on('error', (err: { code: string }) => resolve(err.code))
      client.emit('join_consultation', { consultation_id: 'nonexistent' })
    })
    expect(errorCode).toBe('NOT_FOUND')
  })
})

describe('send_message', () => {
  it('persists message and broadcasts to room', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...mockConsultation })
    mockDb.message.create.mockResolvedValue({ ...mockMessage })

    const patToken = makeToken(PAT_ID, Role.patient)
    const docToken = makeToken(DOC_ID, Role.doctor)

    const [patClient, docClient] = await Promise.all([connect(patToken), connect(docToken)])

    await Promise.all([
      new Promise<void>(resolve => { patClient.emit('join_consultation', { consultation_id: CONSULT_ID }); setTimeout(resolve, 50) }),
      new Promise<void>(resolve => { docClient.emit('join_consultation', { consultation_id: CONSULT_ID }); setTimeout(resolve, 50) }),
    ])

    const received = await new Promise<Record<string, unknown>>((resolve) => {
      docClient.on('receive_message', resolve)
      patClient.emit('send_message', { consultation_id: CONSULT_ID, content: 'Hello doc', msg_type: 'text' })
    })

    expect(received.content).toBe('Hello doc')
    expect(received.sender_id).toBe(PAT_ID)
    expect(mockDb.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consultation_id: CONSULT_ID,
          sender_id: PAT_ID,
          content: 'Hello doc',
        }),
      })
    )
  })
})
