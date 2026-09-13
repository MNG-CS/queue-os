// supabase/functions/line-webhook/index.ts
//
// รับ webhook จาก LINE, ตรวจสอบ signature, ทำ waterfall layer:
// postback -> keyword -> booking state machine -> (Haiku fallback, ยังไม่ต่อใน commit นี้)
// แล้วส่ง reply กลับ LINE จริงผ่าน Messaging API
//
// Deno ใช้ Deno.env.get() อ่านค่า secret แทน process.env แบบ Node
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET")!;
const CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --------------------------------------------------------------
// ขั้นที่ 1: ตรวจสอบ signature ว่า request นี้มาจาก LINE จริง
// --------------------------------------------------------------
async function verifySignature(body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const hmac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const computedSignature = btoa(String.fromCharCode(...new Uint8Array(hmac)));

  return computedSignature === signature;
}

// --------------------------------------------------------------
// ขั้นที่ 2: Waterfall layer แรก — postback แล้วค่อย keyword match
// --------------------------------------------------------------
function matchPostback(data: string): string | null {
  if (data === "action=view_booking") {
    return "นี่คือรายการจองของคุณ (จะเชื่อม Supabase จริงใน layer ถัดไป)";
  }
  return null;
}

// คำสั่งที่ trigger การเริ่มจอง — คืน null ถ้าไม่ตรง เพื่อให้ไปเช็ค keyword อื่นต่อ
function isBookingTrigger(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized.includes("จอง") || normalized.includes("นัด");
}

function matchKeyword(text: string): string | null {
  const normalized = text.trim().toLowerCase();

  if (normalized.includes("ราคา")) {
    return "ดูราคาวัคซีนแต่ละตัวได้ที่เมนูจองค่ะ";
  }

  return null;
}

// --------------------------------------------------------------
// Helper: หา tenant แรก (MVP dogfooding เดี่ยว ยังไม่รองรับเลือก tenant)
// --------------------------------------------------------------
async function getDefaultTenant() {
  const { data, error } = await supabase.from("tenants").select("id, name").limit(1).single();
  if (error) throw error;
  return data;
}

// --------------------------------------------------------------
// Helper: หา หรือสร้าง customer จาก line_user_id
// --------------------------------------------------------------
async function getOrCreateCustomer(lineUserId: string) {
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ line_user_id: lineUserId })
    .select("id")
    .single();

  if (error) throw error;
  return created;
}

// --------------------------------------------------------------
// Helper: อ่าน / เขียน conversation state
// --------------------------------------------------------------
async function getConversationState(lineUserId: string) {
  const { data } = await supabase
    .from("conversation_states")
    .select("state, context")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  return data ?? { state: "idle", context: {} };
}

async function setConversationState(
  lineUserId: string,
  state: string,
  context: Record<string, unknown>,
) {
  await supabase
    .from("conversation_states")
    .upsert(
      { line_user_id: lineUserId, state, context, updated_at: new Date().toISOString() },
      { onConflict: "line_user_id" },
    );
}

// --------------------------------------------------------------
// ขั้นที่ 3: Booking state machine (layer 3 ของ waterfall)
// --------------------------------------------------------------
async function startBookingFlow(lineUserId: string): Promise<string> {
  const tenant = await getDefaultTenant();

  const { data: prices, error } = await supabase
    .from("vaccine_prices")
    .select("price, vaccines(id, name)")
    .eq("tenant_id", tenant.id);

  if (error || !prices || prices.length === 0) {
    return "ขออภัยค่ะ ตอนนี้ยังไม่มีวัคซีนให้จองที่คลินิกนี้";
  }

  const vaccineList = prices.map((p: any, i: number) => ({
    index: i + 1,
    vaccine_id: p.vaccines.id,
    name: p.vaccines.name,
    price: p.price,
  }));

  await setConversationState(lineUserId, "awaiting_vaccine", { vaccineList });

  const lines = vaccineList
    .map((v) => `${v.index}. ${v.name} - ${v.price} บาท`)
    .join("\n");

  return `เลือกวัคซีนที่ต้องการจองค่ะ (พิมพ์ตัวเลข)\n${lines}`;
}

async function handleBookingStep(
  lineUserId: string,
  text: string,
  state: string,
  context: any,
): Promise<string> {
  const trimmed = text.trim();

  if (state === "awaiting_vaccine") {
    const choice = parseInt(trimmed, 10);
    const vaccineList = context.vaccineList ?? [];
    const selected = vaccineList.find((v: any) => v.index === choice);

    if (!selected) {
      return `กรุณาพิมพ์ตัวเลข 1-${vaccineList.length} เพื่อเลือกวัคซีนค่ะ`;
    }

    await setConversationState(lineUserId, "awaiting_date", {
      ...context,
      selectedVaccine: selected,
    });

    return `เลือก ${selected.name} (${selected.price} บาท)\nกรุณาพิมพ์วันที่ต้องการนัด รูปแบบ YYYY-MM-DD (เช่น 2026-09-20)`;
  }

  if (state === "awaiting_date") {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(trimmed)) {
      return "รูปแบบวันที่ไม่ถูกต้องค่ะ กรุณาพิมพ์แบบ YYYY-MM-DD เช่น 2026-09-20";
    }

    const parsedDate = new Date(trimmed);
    if (isNaN(parsedDate.getTime())) {
      return "วันที่ไม่ถูกต้องค่ะ กรุณาลองใหม่อีกครั้ง";
    }

    await setConversationState(lineUserId, "awaiting_confirm", {
      ...context,
      appointmentDate: trimmed,
    });

    const v = context.selectedVaccine;
    return `สรุปการจอง:\n- วัคซีน: ${v.name}\n- ราคา: ${v.price} บาท\n- วันที่: ${trimmed}\n\nพิมพ์ "ยืนยัน" เพื่อยืนยันการจอง หรือ "ยกเลิก" เพื่อยกเลิก`;
  }

  if (state === "awaiting_confirm") {
    if (trimmed === "ยกเลิก") {
      await setConversationState(lineUserId, "idle", {});
      return "ยกเลิกการจองแล้วค่ะ พิมพ์ 'จอง' ใหม่ได้ทุกเมื่อ";
    }

    if (trimmed === "ยืนยัน") {
      const tenant = await getDefaultTenant();
      const customer = await getOrCreateCustomer(lineUserId);
      const v = context.selectedVaccine;

      const qrToken = crypto.randomUUID();

      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          customer_id: customer.id,
          tenant_id: tenant.id,
          appointment_date: context.appointmentDate,
          total_price: v.price,
          status: "confirmed",
          deposit_amount: 0,
          qr_code_token: qrToken,
        })
        .select("id")
        .single();

      if (bookingError) {
        console.error("Booking insert failed:", bookingError);
        return "ขออภัยค่ะ เกิดข้อผิดพลาดในการบันทึกการจอง กรุณาลองใหม่อีกครั้ง";
      }

      const { error: itemError } = await supabase.from("booking_items").insert({
        booking_id: booking.id,
        vaccine_id: v.vaccine_id,
        price_at_booking: v.price,
      });

      if (itemError) {
        console.error("Booking item insert failed:", itemError);
      }

      await setConversationState(lineUserId, "idle", {});

      return `จองสำเร็จค่ะ! 🎉\nหมายเลขการจอง: ${booking.id.slice(0, 8)}\nวันที่: ${context.appointmentDate}\nกรุณามาถึงคลินิกตรงเวลาและแสดง QR code ที่เคาน์เตอร์ค่ะ`;
    }

    return "กรุณาพิมพ์ 'ยืนยัน' หรือ 'ยกเลิก' ค่ะ";
  }

  // ไม่ควรมาถึงจุดนี้ แต่กันไว้เผื่อ state เพี้ยน
  await setConversationState(lineUserId, "idle", {});
  return "ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาพิมพ์ 'จอง' ใหม่อีกครั้ง";
}

// --------------------------------------------------------------
// ส่ง reply กลับไปที่ LINE จริงผ่าน Messaging API
// --------------------------------------------------------------
async function replyToLine(replyToken: string, text: string) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("LINE reply failed:", res.status, errBody);
  }
}

// --------------------------------------------------------------
// Entry point — Supabase Edge Function ใช้ Deno.serve
// --------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  const isValid = await verifySignature(body, signature);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(body);

  for (const event of payload.events ?? []) {
    if (event.type !== "message" && event.type !== "postback") continue;

    const lineUserId = event.source?.userId;
    const replyToken = event.replyToken;
    if (!lineUserId || !replyToken) continue;

    let replyText: string | null = null;

    try {
      if (event.type === "postback") {
        replyText = matchPostback(event.postback.data);
      } else if (event.type === "message" && event.message.type === "text") {
        const text = event.message.text;
        const { state, context } = await getConversationState(lineUserId);

        if (state !== "idle") {
          // ลูกค้ากำลังอยู่กลาง booking flow — ให้ state machine จัดการต่อ ไม่เช็ค keyword อื่น
          replyText = await handleBookingStep(lineUserId, text, state, context);
        } else if (isBookingTrigger(text)) {
          replyText = await startBookingFlow(lineUserId);
        } else {
          replyText = matchKeyword(text);
        }
      }
    } catch (err) {
      console.error("Error handling event:", err);
      replyText = "ขออภัยค่ะ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง";
    }

    console.log("Matched reply:", replyText ?? "(no rule matched — จะส่งต่อ Claude Haiku ใน Week 8)");

    if (replyText) {
      await replyToLine(replyToken, replyText);
    } else {
      // ยังไม่ต่อ Haiku fallback ใน commit นี้ — ตอบ placeholder ไปก่อน
      await replyToLine(replyToken, "ขอโทษค่ะ ยังไม่เข้าใจข้อความนี้ พิมพ์ 'จอง' เพื่อเริ่มจองวัคซีนได้เลยค่ะ");
    }
  }

  return new Response("OK", { status: 200 });
});