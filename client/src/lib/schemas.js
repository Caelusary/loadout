import { z } from 'zod';

// Mirrors server/src/models/address.js
export const addressSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(80, 'Full name must be at most 80 characters'),
  line1: z.string().trim().min(1, 'Street address is required').max(120, 'Street address must be at most 120 characters'),
  city: z.string().trim().min(1, 'City is required').max(60, 'City must be at most 60 characters'),
  province: z.string().trim().min(1, 'Province is required').max(60, 'Province must be at most 60 characters'),
  postalCode: z
    .string()
    .trim()
    .min(1, 'Postal code is required')
    .regex(/^\d{4,10}$/, 'Postal code must be 4 to 10 digits'),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s()-]/g, ''))
    .pipe(z.string().min(1, 'Mobile number is required').regex(/^\+?\d{7,15}$/, 'Enter a valid phone number')),
});

export const emptyAddress = { fullName: '', line1: '', city: '', province: '', postalCode: '', phone: '' };

export const emailField = z.string().trim().min(1, 'Email is required').email('Enter a valid email address, like name@example.com');
export const nameField = z
  .string()
  .trim()
  .min(1, 'Full name is required')
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be at most 50 characters');
