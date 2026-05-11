import api from './api';
import type { CloudinaryUploadResult, UploadSignature } from '@/types';

export async function getUploadSignature(
  projectId: string,
): Promise<UploadSignature> {
  const { data } = await api.post<UploadSignature>('/uploads/sign', {
    projectId,
  });
  return data;
}

export async function uploadToCloudinary(
  file: File,
  signature: UploadSignature,
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  const url = `https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`;

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('folder', signature.folder);
  form.append('signature', signature.signature);

  return await new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    if (onProgress) {
      xhr.upload.onprogress = (event: ProgressEvent) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as CloudinaryUploadResult);
        } catch {
          reject(new Error('Cloudinary returned an unexpected response.'));
        }
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText) as {
            error?: { message?: string };
          };
          if (body.error?.message) message = body.error.message;
        } catch {
          /* ignore */
        }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(form);
  });
}

export async function uploadAttachment(
  file: File,
  projectId: string,
  onProgress?: (percent: number) => void,
): Promise<{
  name: string;
  url: string;
  publicId: string;
  mimeType: string;
  size: number;
}> {
  const signature = await getUploadSignature(projectId);
  const result = await uploadToCloudinary(file, signature, onProgress);
  return {
    name: file.name,
    url: result.secure_url,
    publicId: result.public_id,
    mimeType: file.type,
    size: result.bytes,
  };
}
