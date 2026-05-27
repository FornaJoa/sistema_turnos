interface WhatsAppPayload {
  to: string;
  template: string;
  variables: Record<string, string>;
}

export async function sendWhatsAppNotification(payload: WhatsAppPayload) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    console.log("[whatsapp:dev]", payload);
    return { ok: true, mode: "dev-log" };
  }

  const templateName = mapTemplateName(payload.template);
  const bodyParameters = Object.values(payload.variables).map((text) => ({
    type: "text",
    text,
  }));

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: payload.to.replace(/\D/g, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: "es_AR" },
          components: [
            {
              type: "body",
              parameters: bodyParameters,
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp API error: ${errorText}`);
  }

  return response.json();
}

function mapTemplateName(event: string): string {
  const mapping: Record<string, string> = {
    appointment_created: "turno_confirmado",
    appointment_confirmed: "turno_confirmado",
    appointment_cancelled: "turno_cancelado",
    appointment_updated: "turno_confirmado",
    appointment_reminder: "recordatorio",
  };

  return mapping[event] ?? "turno_confirmado";
}
