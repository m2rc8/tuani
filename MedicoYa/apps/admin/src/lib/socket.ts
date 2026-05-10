'use client'
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(token: string): Socket {
  const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''
  if (!socket || !socket.connected) {
    socket = io(BASE, { auth: { token }, transports: ['websocket'] })
  }
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
