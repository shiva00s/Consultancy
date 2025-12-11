import { z } from 'zod';

// Candidate Schema
export const candidateSchema = z.object({
  first_name: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s-']+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  
  last_name: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s-']+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
  
  email: z.string()
    .email('Invalid email address')
    .max(100, 'Email must be less than 100 characters'),
  
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  
  passport_number: z.string()
    .regex(/^[A-Z0-9]{6,12}$/, 'Invalid passport number')
    .optional()
    .or(z.literal('')),
  
  date_of_birth: z.string()
    .refine((date) => {
      const age = new Date().getFullYear() - new Date(date).getFullYear();
      return age >= 18 && age <= 100;
    }, 'Candidate must be between 18 and 100 years old')
    .optional()
    .or(z.literal('')),
  
  skills: z.string()
    .max(1000, 'Skills description too long')
    .optional()
    .or(z.literal('')),
  
  experience_years: z.number()
    .min(0, 'Experience cannot be negative')
    .max(60, 'Invalid experience years')
    .optional()
    .or(z.literal('')),
  
  salary_expectation: z.number()
    .min(0, 'Salary cannot be negative')
    .optional()
    .or(z.literal('')),
});

// Login Schema
export const loginSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long'),
});

// User Registration Schema
export const registrationSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  
  confirmPassword: z.string(),
  
  email: z.string()
    .email('Invalid email address')
    .max(100, 'Email must be less than 100 characters'),
  
  full_name: z.string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be less than 100 characters'),
  
  role: z.enum(['staff', 'admin', 'super_admin']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Employer Schema
export const employerSchema = z.object({
  company_name: z.string()
    .min(2, 'Company name must be at least 2 characters')
    .max(100, 'Company name must be less than 100 characters'),
  
  contact_person: z.string()
    .min(2, 'Contact person must be at least 2 characters')
    .max(100, 'Contact person must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  
  email: z.string()
    .email('Invalid email address')
    .max(100, 'Email must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  
  address: z.string()
    .max(500, 'Address too long')
    .optional()
    .or(z.literal('')),
});

// Job Order Schema
export const jobOrderSchema = z.object({
  job_title: z.string()
    .min(2, 'Job title must be at least 2 characters')
    .max(100, 'Job title must be less than 100 characters'),
  
  employer_id: z.number().positive('Please select an employer'),
  
  location: z.string()
    .min(2, 'Location must be at least 2 characters')
    .max(100, 'Location must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  
  salary_range: z.string()
    .max(100, 'Salary range description too long')
    .optional()
    .or(z.literal('')),
  
  requirements: z.string()
    .max(2000, 'Requirements description too long')
    .optional()
    .or(z.literal('')),
  
  vacancies: z.number()
    .min(1, 'Must have at least 1 vacancy')
    .max(1000, 'Invalid vacancy count')
    .optional()
    .or(z.literal('')),
  
  deadline: z.string()
    .refine((date) => {
      if (!date) return true;
      return new Date(date) >= new Date();
    }, 'Deadline must be in the future')
    .optional()
    .or(z.literal('')),
});

// Payment Schema
export const paymentSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .max(1000000, 'Amount too large'),
  
  payment_date: z.string()
    .refine((date) => {
      if (!date) return false;
      return new Date(date) <= new Date();
    }, 'Payment date cannot be in the future'),
  
  payment_method: z.enum(['cash', 'bank_transfer', 'cheque', 'card', 'other']),
  
  reference_number: z.string()
    .max(100, 'Reference number too long')
    .optional()
    .or(z.literal('')),
  
  notes: z.string()
    .max(500, 'Notes too long')
    .optional()
    .or(z.literal('')),
});
