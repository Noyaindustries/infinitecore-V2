export type AppointmentLeadInput = {
  appId: string;
  appTitle: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  companyName: string;
  preferredDate: string;
  message: string;
};

export function parseAppointmentBody(body: Record<string, unknown>): {
  ok: true;
  data: AppointmentLeadInput;
} | {
  ok: false;
  error: string;
} {
  const appId = String(body.appId || '').trim();
  const appTitle = String(body.appTitle || '').trim();
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const companyName = String(body.companyName || '').trim();
  const preferredDate = String(body.preferredDate || '').trim();
  const message = String(body.message || '').trim();

  if (!appId || !firstName || !lastName || !phone) {
    return {
      ok: false,
      error: 'Champs requis : application, prénom, nom, téléphone/WhatsApp.',
    };
  }

  return {
    ok: true,
    data: {
      appId,
      appTitle,
      firstName,
      lastName,
      phone,
      email,
      companyName,
      preferredDate,
      message,
    },
  };
}
