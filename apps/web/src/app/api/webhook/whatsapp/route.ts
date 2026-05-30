import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/webhook/whatsapp
 *
 * Meta webhook verification handshake.
 * Meta sends hub.mode=subscribe, hub.verify_token, hub.challenge.
 * We must respond with hub.challenge when the token matches.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST /api/webhook/whatsapp
 *
 * Receives incoming WhatsApp messages and delivery status updates from Meta.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[whatsapp:webhook]", JSON.stringify(body));

    // Process each entry / change from Meta
    const entries = body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;

        // Incoming message
        for (const message of value?.messages ?? []) {
          console.log("[whatsapp:incoming]", {
            from: message.from,
            type: message.type,
            text: message.text?.body,
          });
          // TODO: handle inbound messages (e.g. confirmations via reply)
        }

        // Delivery / read status updates
        for (const status of value?.statuses ?? []) {
          console.log("[whatsapp:status]", {
            id: status.id,
            status: status.status,
            recipient: status.recipient_id,
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[whatsapp:webhook:error]", err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
