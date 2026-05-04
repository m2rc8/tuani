import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UploadService } from './UploadService'

vi.mock('../lib/cloudinary', () => ({
  uploadStream: vi.fn(),
}))

import { uploadStream } from '../lib/cloudinary'

describe('UploadService', () => {
  let svc: UploadService

  beforeEach(() => {
    vi.clearAllMocks()
    svc = new UploadService()
  })

  it('returns Cloudinary URL on success', async () => {
    vi.mocked(uploadStream).mockResolvedValue('https://res.cloudinary.com/test/image/upload/v1/test.jpg')
    const url = await svc.uploadPhoto(Buffer.from('fake-image'), 'image/jpeg')
    expect(url).toBe('https://res.cloudinary.com/test/image/upload/v1/test.jpg')
    expect(uploadStream).toHaveBeenCalledWith(Buffer.from('fake-image'), 'medicoya/symptoms')
  })

  it('propagates error when upload fails', async () => {
    vi.mocked(uploadStream).mockRejectedValue(new Error('Upload failed'))
    await expect(svc.uploadPhoto(Buffer.from('bad'), 'image/jpeg')).rejects.toThrow('Upload failed')
  })
})
