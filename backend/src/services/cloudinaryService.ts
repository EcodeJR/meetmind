import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../utils/logger';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

export const uploadAudioToCloudinary = async (filePath: string): Promise<CloudinaryUploadResult> => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'auto',
      folder: 'meetmind/audio',
    });

    logger.info({ publicId: result.public_id }, 'Audio uploaded to Cloudinary');

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to upload audio to Cloudinary');
    throw error;
  }
};

export const deleteAudioFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
    logger.info({ publicId }, 'Audio deleted from Cloudinary');
  } catch (error) {
    logger.error({ error, publicId }, 'Failed to delete audio from Cloudinary');
    throw error;
  }
};
