import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  url: string;
  asset_folder: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class CloudinaryService {
  private cloudName = environment.cloudinary.cloudName;
  private uploadPreset = environment.cloudinary.uploadPreset;
  private imageUploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
  private rawUploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/raw/upload`;

  constructor() {}

  /**
   * Subir imagen a Cloudinary
   * @param file - Archivo de imagen a subir
   * @returns Promise con la URL de la imagen subida
   */
  async uploadImage(file: File): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', this.uploadPreset);
      formData.append('folder', 'user-profiles');

      const response = await fetch(this.imageUploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Error al subir la imagen a Cloudinary');
      }

      const data: CloudinaryUploadResponse = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Subir archivo (imagen o PDF) a Cloudinary
   * @param file - Archivo a subir
   * @param uploadPreset - Preset de Cloudinary a usar
   * @param folder - Carpeta donde almacenar el archivo
   * @returns Promise con la respuesta completa de Cloudinary
   */
  async uploadFile(file: File, uploadPreset?: string, folder: string = 'lessons'): Promise<CloudinaryUploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset || this.uploadPreset);
      formData.append('folder', folder);

      // Usar URL diferente según el tipo de archivo
      const uploadUrl = file.type.startsWith('image/') ? this.imageUploadUrl : this.rawUploadUrl;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Error al subir el archivo a Cloudinary');
      }

      const data: CloudinaryUploadResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error uploading file to Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Validar que el archivo sea una imagen
   * @param file - Archivo a validar
   * @returns true si es una imagen válida
   */
  isValidImageFile(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      alert('Por favor selecciona una imagen válida (JPG, PNG, GIF, WEBP)');
      return false;
    }

    if (file.size > maxSize) {
      alert('La imagen no debe superar los 5MB');
      return false;
    }

    return true;
  }

  /**
   * Crear URL de preview local para la imagen
   * @param file - Archivo de imagen
   * @returns URL del preview
   */
  createImagePreview(file: File): string {
    return URL.createObjectURL(file);
  }
}
