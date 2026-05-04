import { uploadStream } from '../lib/cloudinary'

export class UploadService {
  async uploadPhoto(buffer: Buffer, _mimetype: string): Promise<string> {
    return uploadStream(buffer, 'medicoya/symptoms')
  }
}
