// SendGrid email integration for Rebel Chefs
import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email };
}

async function getUncachableSendGridClient() {
  const { apiKey, email } = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

const FRATERNITY_ABBREV: Record<string, string> = {
  "Delta Tau Delta": "DTD",
  "Sigma Chi": "SIGMACHI",
};

export function generateTempPassword(name: string, fraternity: string): string {
  const parts = name.trim().split(/\s+/);
  const firstInitial = (parts[0]?.[0] || '').toUpperCase();
  const lastInitial = (parts[parts.length - 1]?.[0] || '').toUpperCase();
  const fratAbbrev = FRATERNITY_ABBREV[fraternity] || fraternity.replace(/\s+/g, '').toUpperCase();
  return `${firstInitial}${lastInitial}HD${fratAbbrev}`;
}

export async function sendWelcomeEmail(toEmail: string, name: string, tempPassword: string, fraternity: string): Promise<void> {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const msg = {
      to: toEmail,
      from: fromEmail,
      subject: 'Welcome to Rebel Chefs - House Director Account',
      text: `Hi ${name},\n\nYou've been added as a House Director for ${fraternity} on Rebel Chefs!\n\nYour temporary login credentials are:\nEmail: ${toEmail}\nPassword: ${tempPassword}\n\nPlease log in and change your password as soon as possible for security.\n\nLog in at: ${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : process.env.REPLIT_DEPLOYMENT_URL || 'the Rebel Chefs app'}\n\nBest,\nThe Rebel Chefs Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">Welcome to Rebel Chefs!</h2>
          <p>Hi ${name},</p>
          <p>You've been added as a <strong>House Director</strong> for <strong>${fraternity}</strong> on Rebel Chefs.</p>
          <p>Your temporary login credentials are:</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Email:</strong> ${toEmail}</p>
            <p style="margin: 4px 0;"><strong>Password:</strong> ${tempPassword}</p>
          </div>
          <p style="color: #dc2626; font-weight: bold;">Please log in and change your password as soon as possible for security.</p>
          <p>Best,<br/>The Rebel Chefs Team</p>
        </div>
      `,
    };

    await client.send(msg);
    console.log(`[Email] Welcome email sent to ${toEmail}`);
  } catch (error) {
    console.error(`[Email] Failed to send welcome email to ${toEmail}:`, error);
    throw error;
  }
}
