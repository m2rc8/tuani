import { io, type Socket } from 'socket.io-client'

let _socket: Socket | null = null

export const socketService = {
  connect(baseURL: string, token: string) {
    if (_socket?.connected) return
    _socket = io(baseURL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    })
  },

  disconnect() {
    _socket?.disconnect()
    _socket = null
  },

  emit(event: string, data: unknown) {
    _socket?.emit(event, data)
  },

  on(event: string, cb: (data: any) => void) {
    _socket?.on(event, cb)
  },

  off(event: string, cb?: (data: any) => void) {
    _socket?.off(event, cb)
  },

  get connected(): boolean {
    return _socket?.connected ?? false
  },
}
