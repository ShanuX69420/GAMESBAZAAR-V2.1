import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { uploadImage, validateImage, UploadOptions } from '../services/imageUpload';

export default async function uploadRoutes(fastify: FastifyInstance) {
  // Register multipart content parser if not already registered
  if (!fastify.hasContentTypeParser('multipart/form-data')) {
    await fastify.register(import('@fastify/multipart'));
  }

  // Upload single image
  fastify.post<{
    Querystring: { folder?: string };
  }>('/upload/image', {
    preHandler: requireAuth,
  }, async (request: FastifyRequest<{
    Querystring: { folder?: string };
  }>, reply: FastifyReply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          error: 'No file provided',
          success: false,
        });
      }

      // Validate file
      const validation = validateImage(data.mimetype, data.file.readableLength || 0);
      if (!validation.valid) {
        return reply.status(400).send({
          error: validation.error,
          success: false,
        });
      }

      // Convert file stream to buffer
      const buffer = await data.toBuffer();

      // Upload options
      const uploadOptions: UploadOptions = {
        folder: request.query.folder || 'marketplace',
        resource_type: 'image',
      };

      // Upload to Cloudinary
      const result = await uploadImage(buffer, uploadOptions);

      return reply.send({
        success: true,
        data: {
          id: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.bytes,
        },
      });
    } catch (error) {
      console.error('Image upload error:', error);
      return reply.status(500).send({
        error: 'Failed to upload image',
        success: false,
      });
    }
  });

  // Upload multiple images (up to 5 for listings)
  fastify.post<{
    Querystring: { folder?: string };
  }>('/upload/images', {
    preHandler: requireAuth,
  }, async (request: FastifyRequest<{
    Querystring: { folder?: string };
  }>, reply: FastifyReply) => {
    try {
      const files = request.files();
      const uploadedImages = [];
      let fileCount = 0;

      for await (const file of files) {
        fileCount++;
        
        // Limit to 5 images for listings
        if (fileCount > 5) {
          return reply.status(400).send({
            error: 'Maximum 5 images allowed per upload',
            success: false,
          });
        }

        // Validate each file
        const validation = validateImage(file.mimetype, file.file.readableLength || 0);
        if (!validation.valid) {
          return reply.status(400).send({
            error: `File ${file.filename}: ${validation.error}`,
            success: false,
          });
        }

        // Convert to buffer and upload
        const buffer = await file.toBuffer();
        const uploadOptions: UploadOptions = {
          folder: request.query.folder || 'marketplace/listings',
          resource_type: 'image',
        };

        const result = await uploadImage(buffer, uploadOptions);
        uploadedImages.push({
          id: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.bytes,
        });
      }

      if (uploadedImages.length === 0) {
        return reply.status(400).send({
          error: 'No valid images provided',
          success: false,
        });
      }

      return reply.send({
        success: true,
        data: uploadedImages,
      });
    } catch (error) {
      console.error('Multiple images upload error:', error);
      return reply.status(500).send({
        error: 'Failed to upload images',
        success: false,
      });
    }
  });
}