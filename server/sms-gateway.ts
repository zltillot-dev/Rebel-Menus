// ═══════════════════════════════════════════════════════════════════════════════
// Email-to-SMS Gateway — Replaces Twilio
// Sends text messages via carrier email gateways through Gmail SMTP
// No Twilio approval needed, zero cost, works immediately
// ═══════════════════════════════════════════════════════════════════════════════

import nodemailer from "nodemailer";

const GMAIL_USER = "rebelchefsms@gmail.com";
const GMAIL_APP_PASS = "cmvhyqhxbyhmxswb";

// All major US carrier gateways
const CARRIER_GATEWAYS = [
  "vtext.com",           // Verizon
  "txt.att.net",         // AT&T
  "tmomail.net",         // T-Mobile
  "messaging.sprintpcs.com", // Sprint / T-Mobile
  "msg.fi.google.com",   // Google Fi
  "sms.myboostmobile.com", // Boost Mobile
  "text.republicwireless.com", // Republic Wireless
  "vmobl.com",           // Virgin Mobile
  "mmst5.tracfone.com",  // Tracfone
];

// Known carriers (skip the shotgun approach for these)
const KNOWN_CARRIERS: Record<string, string> = {
  "6014155059": "vtext.com",  // Zak — Verizon
};

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS },
});

/**
 * Send an SMS via email-to-SMS carrier gateways.
 * If the carrier is known, sends to that gateway only.
 * Otherwise, sends to ALL major carrier gateways (only the correct one delivers).
 */
export async function sendSMS(to: string, body: string): Promise<boolean> {
  // Clean phone number to digits only
  const digits = to.replace(/\D/g, "");
  const phone = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (phone.length !== 10) {
    console.error(`[SMS-Gateway] Invalid phone number: ${to}`);
    return false;
  }

  // Truncate body to 160 chars for SMS compatibility
  const smsBody = body.length > 160 ? body.slice(0, 157) + "..." : body;

  try {
    const knownGateway = KNOWN_CARRIERS[phone];
    const gateways = knownGateway ? [knownGateway] : CARRIER_GATEWAYS;

    const recipients = gateways.map((gw) => `${phone}@${gw}`);

    // Send to all gateways (wrong ones silently fail or bounce)
    await transporter.sendMail({
      from: `"Rebel Chefs" <${GMAIL_USER}>`,
      to: recipients.join(", "),
      subject: "",  // SMS gateways ignore subject; some prepend it
      text: smsBody,
    });

    const method = knownGateway ? `known carrier (${knownGateway})` : `all ${gateways.length} gateways`;
    console.log(`[SMS-Gateway] Sent to ${phone} via ${method}`);
    return true;
  } catch (error: any) {
    console.error(`[SMS-Gateway] Failed to send to ${phone}:`, error.message);
    return false;
  }
}
