import mongoose from 'mongoose';

// Shared by User (saved address) and Order (address the order ships to).
// _id: false because an address is a value, not a document of its own.
export const addressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [80, 'Full name must be at most 80 characters'],
    },
    line1: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
      maxlength: [120, 'Street address must be at most 120 characters'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [60, 'City must be at most 60 characters'],
    },
    province: {
      type: String,
      required: [true, 'Province is required'],
      trim: true,
      maxlength: [60, 'Province must be at most 60 characters'],
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
      match: [/^\d{4,10}$/, 'Postal code must be 4 to 10 digits'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^\+?\d{7,15}$/, 'Enter a valid phone number'],
    },
  },
  { _id: false }
);
