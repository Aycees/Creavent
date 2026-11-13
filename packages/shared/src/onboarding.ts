import { z } from 'zod';
import { approvalStatusSchema, roleTypeSchema } from './accounts.js';

// Onboarding (spec §1.1, flow 1) and the organizer approval request (§2.1).

// A Philippine mobile number, entered after the +63 prefix or in full.
// Stored as +639XXXXXXXXX.
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .transform((v) => v.replace(/^(\+?63|0)/, ''))
  .refine((v) => /^9\d{9}$/.test(v), 'Enter a mobile number like 917 123 4567')
  .transform((v) => `+63${v}`);

const urlSchema = z
  .string()
  .trim()
  .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
  .pipe(z.url({ protocol: /^https?$/, message: 'Enter a link like facebook.com/yourpage' }));

export const socialLinksSchema = z.array(urlSchema).max(10, 'Add up to 10 links');

// Page links (spec §7.2): lowercase letters, numbers, and hyphens, 3 to 40.
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens')
  .min(3, 'Use at least 3 characters')
  .max(40, 'Use at most 40 characters');

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const chooseRolesSchema = z.object({
  roles: z.array(roleTypeSchema).min(1, 'Pick at least one').max(2),
});
export type ChooseRolesInput = z.input<typeof chooseRolesSchema>;

export const vendorShopSchema = z.object({
  shopName: z.string().trim().min(1, 'Enter your shop name').max(60, 'Use at most 60 characters'),
  categoryIds: z.array(z.uuid()).min(1, 'Pick at least one category'),
  description: optionalText(300),
  products: optionalText(200),
});
export type VendorShopInput = z.input<typeof vendorShopSchema>;

export const vendorPhotosSchema = z.object({
  avatarFileId: z.uuid().nullable(),
  photoFileIds: z.array(z.uuid()).max(8, 'Add up to 8 photos'),
});
export type VendorPhotosInput = z.input<typeof vendorPhotosSchema>;

export const vendorContactSchema = z.object({
  phone: phoneSchema,
  socialLinks: socialLinksSchema,
});
export type VendorContactInput = z.input<typeof vendorContactSchema>;

export const organizerPageSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter your organizer name').max(60, 'Use at most 60 characters'),
  slug: slugSchema,
  logoFileId: z.uuid().nullable(),
  city: optionalText(60),
  about: optionalText(600),
});
export type OrganizerPageInput = z.input<typeof organizerPageSchema>;

export const organizerContactSchema = z.object({
  phone: phoneSchema,
  contactEmail: z.email('Enter a valid email'),
});
export type OrganizerContactInput = z.input<typeof organizerContactSchema>;

export const organizerApprovalSchema = z.object({
  socialLinks: socialLinksSchema.min(1, 'Add at least one link'),
  // false is "Do this later": the links are saved, approval stays as it is.
  submit: z.boolean(),
});
export type OrganizerApprovalInput = z.input<typeof organizerApprovalSchema>;

export const categorySchema = z.object({ id: z.uuid(), name: z.string() });

const imageSchema = z.object({ id: z.uuid(), url: z.string() });

export const onboardingStateSchema = z.object({
  categories: z.array(categorySchema),
  phone: z.string().nullable(),
  avatar: imageSchema.nullable(),
  vendor: z
    .object({
      shopName: z.string(),
      slug: z.string().nullable(),
      categoryIds: z.array(z.uuid()),
      description: z.string().nullable(),
      products: z.string().nullable(),
      photos: z.array(imageSchema),
      socialLinks: z.array(z.string()),
    })
    .nullable(),
  organizer: z
    .object({
      displayName: z.string(),
      slug: z.string().nullable(),
      logo: imageSchema.nullable(),
      city: z.string().nullable(),
      about: z.string().nullable(),
      socialLinks: z.array(z.string()),
      contactEmail: z.string().nullable(),
      approvalStatus: approvalStatusSchema,
      approvalSubmittedAt: z.string().nullable(),
      rejectionReason: z.string().nullable(),
    })
    .nullable(),
});
export type OnboardingState = z.infer<typeof onboardingStateSchema>;

// A page link suggested from a name: lowercase, hyphens, 3 to 40 characters.
export function slugify(name: string) {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return base.length >= 3 ? base : `${base}${base ? '-' : ''}shop`.slice(0, 40);
}
