import { z } from 'zod';

export const UserProfileSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis').max(80),
  lastName: z.string().min(1, 'Nom requis').max(80),
  displayName: z.string().optional(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  photoURL: z.string().url().optional().or(z.literal('')),
});

export const OrderSchema = z.object({
  serviceId: z.string().min(1),
  serviceName: z.string().min(1),
  amount: z.number().positive(),
  billingCycle: z.enum(['month', 'year']),
  note: z.string().optional(),
});

/** Clés = champs formulaire (string) ; valeurs libres — Zod 4 : `record` exige (clé, valeur). */
export const PaddeAuditPayloadSchema = z.record(z.string(), z.unknown()).and(
  z.object({
    email: z.string().email().optional().or(z.literal('')),
    whatsapp: z.string().optional(),
    type: z.string().optional(),
  })
);

export const AuthRegisterSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  companyDescription: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  phone: z.string().optional(),
  referredBy: z.string().optional(),
  referredByPartnerId: z.string().optional(),
  referredByPartnerName: z.string().optional(),
});
