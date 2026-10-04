import { Router } from 'express';
import multer from 'multer';
import { optionalAuth, requireApprovedSeller, requireArea, requireAuth } from '../../middleware/auth.js';
import { invalid } from '../../lib/AppError.js';
import { uploadLimiter } from '../../middleware/limits.js';
import * as products from './controller.js';

// 8 MB fits a .glb model; images are held to 2 MB in the controller. Other file types are turned away
// by name before any of the body is read into memory.
const UPLOAD_EXTS = /\.(jpe?g|png|webp|glb)$/i;
const uploadFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (req, file, cb) =>
    UPLOAD_EXTS.test(file.originalname)
      ? cb(null, true)
      : cb(invalid({ file: 'Upload a JPG, PNG or WebP image, or a .glb 3D model.' })),
}).single('file');

const seller = [requireAuth, requireApprovedSeller];
const router = Router();

// Literal paths before /products/:slug.
router.get('/products', optionalAuth, products.listProducts);
router.get('/products/featured', products.featuredProducts);
router.get('/products/mine', ...seller, products.myProducts);
router.get('/products/:slug', optionalAuth, products.getProduct);
router.post('/products', ...seller, products.createProduct);
router.patch('/products/:id', ...seller, products.updateProduct);
router.delete('/products/:id', ...seller, products.deleteProduct);
router.patch('/admin/products/:id', requireAuth, requireArea('products'), products.moderateProduct);
router.post('/uploads', ...seller, uploadLimiter, uploadFile, products.upload);

export default router;
