import { z } from 'zod';

// Shared by the signup and login forms and the API (spec §1).

export const roleTypeSchema = z.enum(['vendor', 'organizer']);
export type RoleType = z.infer<typeof roleTypeSchema>;

export const approvalStatusSchema = z.enum([
  'not_submitted',
  'pending_review',
  'approved',
  'rejected',
]);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters');

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your full name').max(100),
  email: z.email('Enter a valid email'),
  password: passwordSchema,
  ageConfirmed: z.literal(true, 'Confirm you are 18 or older'),
  acceptLegal: z.literal(true, 'Accept the terms of use and privacy notice'),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email'),
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

// Accepting updated terms, or finishing a Google signup (/account/legal).
export const acceptLegalSchema = z.object({
  ageConfirmed: z.literal(true, 'Confirm you are 18 or older'),
  acceptLegal: z.literal(true, 'Accept the terms of use and privacy notice'),
});
export type AcceptLegalInput = z.infer<typeof acceptLegalSchema>;

export const meRoleSchema = z.object({
  role: roleTypeSchema,
  // Organizers only.
  approvalStatus: approvalStatusSchema.nullable(),
  rejectionReason: z.string().nullable(),
  onboardingStep: z.number().int().nullable(),
  suspended: z.boolean(),
  suspensionReason: z.string().nullable(),
});
export type MeRole = z.infer<typeof meRoleSchema>;

// The signed-in user, as every signed-in screen needs it.
export const meResponseSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isAdmin: z.boolean(),
  // True when the user must accept the current terms and privacy notice, or
  // confirm their age, before any other page (spec §1).
  needsLegal: z.boolean(),
  hasPassword: z.boolean(),
  roles: z.array(meRoleSchema),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

// Platform values the signed-out pages show (data model §5.11).
export const publicConfigSchema = z.object({
  termsVersion: z.string(),
  privacyVersion: z.string(),
  minimumAge: z.number().int(),
  supportEmail: z.string(),
  // Google sign-in shows only when the API has Google credentials.
  googleSignIn: z.boolean(),
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;

// /account: the profile fields a user edits (sitemap §2).
export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your full name').max(100),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
