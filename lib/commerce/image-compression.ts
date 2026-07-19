/** COMMERCE layer — shared image compression helper for product image uploads. */
import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file for upload. Falls back to the original file if
 * compression fails for any reason (e.g. unsupported format).
 */
export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: file.type,
    initialQuality: 0.8,
  };

  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error('Compression error:', error);
    return file;
  }
}
