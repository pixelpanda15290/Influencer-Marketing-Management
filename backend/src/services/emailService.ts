import nodemailer from 'nodemailer';
import dns from 'dns';

// Force Node.js to resolve IPv4 addresses first on cloud environments like Render
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignore if unsupported in Node version
}

const getTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER || 'reena.lalwani@ad2ship.com';
  const pass = process.env.SMTP_PASS || 'gzolidmmbhnmdnrq';

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

export const sendOTPEmail = async (toEmail: string, otpCode: string, userName: string = 'Team Member'): Promise<boolean> => {
  const fromAddress = (process.env.FROM_EMAIL || process.env.SMTP_USER || 'reena.lalwani@ad2ship.com').trim();
  const appName = (process.env.APP_NAME || 'Influencer Marketing Operation').trim();

  const subject = `Your ${appName} security code is ${otpCode}`;
  const textContent = `Hello ${userName},\n\nYour ${appName} security verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this verification code, please ignore this email.\n\nRegards,\n${appName} Security Team`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
        .badge { display: inline-block; background: linear-gradient(135deg, #9333ea, #4f46e5); color: #ffffff; font-weight: 800; font-size: 13px; padding: 6px 16px; border-radius: 12px; letter-spacing: 1px; }
        .title { color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 20px; margin-bottom: 8px; }
        .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
        .otp-card { background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 14px; text-align: center; padding: 20px; margin: 24px 0; }
        .otp-code { font-family: monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #7c3aed; }
        .footer { font-size: 12px; color: #94a3b8; border-t: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="badge">${appName.toUpperCase()}</div>
        <div class="title">Security Verification Code</div>
        <div class="subtitle">Hello <strong>${userName}</strong>, please use the following 6-digit code to complete your login authentication for <strong>${appName}</strong>.</div>

        <div class="otp-card">
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 6px;">Security Verification Code</div>
          <div class="otp-code">${otpCode}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 8px;">Valid for <strong>10 minutes</strong></div>
        </div>

        <p style="font-size: 13px; color: #475569; line-height: 1.5;">
          If you did not request this verification code, please ignore this email or contact system administration immediately.
        </p>

        <div class="footer">
          &copy; ${new Date().getFullYear()} ${appName}. Security & Operations Portal.
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Primary: SMTP via Nodemailer
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = getTransporter();
      const info = await transporter.sendMail({
        from: `"${appName}" <${fromAddress}>`,
        to: toEmail,
        subject: subject,
        text: textContent,
        html: htmlContent
      });

      console.log(`[SMTP Success] Security OTP email delivered to ${toEmail} (MessageId: ${info.messageId})`);
      return true;
    } catch (smtpErr: any) {
      console.error(`[SMTP Error sending OTP to ${toEmail}]:`, smtpErr?.message || smtpErr);
    }
  }

  // 2. Secondary Webhook Fallback (if script.google.com webhook configured)
  const webhookUrl = (process.env.GMAIL_WEBHOOK_URL || '').trim();
  if (webhookUrl && webhookUrl.includes('script.google.com')) {
    try {
      const webhookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow',
        body: JSON.stringify({
          to: toEmail,
          subject: subject,
          text: textContent,
          html: htmlContent
        })
      });

      if (webhookRes.ok || webhookRes.status === 200 || webhookRes.status === 302) {
        console.log(`[Webhook Success] OTP Email delivered to ${toEmail}`);
        return true;
      }
    } catch (webhookErr: any) {
      console.error(`[Webhook Error]`, webhookErr?.message || webhookErr);
    }
  }

  // Fallback Console Log
  console.log(`\n=================================================`);
  console.log(`[SECURITY OTP FALLBACK] EMAIL: ${toEmail} | CODE: ${otpCode}`);
  console.log(`=================================================\n`);
  return true;
};

export const sendManagerApprovalEmail = async (
  managerEmails: string[],
  newUser: { name: string; email: string; phone?: string; department?: string }
): Promise<boolean> => {
  const appName = (process.env.APP_NAME || 'Influencer Marketing Operation').trim();
  const fromAddress = (process.env.FROM_EMAIL || process.env.SMTP_USER || 'reena.lalwani@ad2ship.com').trim();
  const subject = `[ACTION REQUIRED] New User Registration Request - Manager Approval Required: ${newUser.name}`;

  const textContent = `Hello Manager,\n\nA new user account has verified their email address and is requesting access to ${appName}.\n\nUser Details:\n- Name: ${newUser.name}\n- Work Email: ${newUser.email}\n- Phone: ${newUser.phone || 'N/A'}\n- Department: ${newUser.department || 'Influencer Marketing'}\n\nPlease log in to the Influencer Marketing Operation portal and go to Members Directory to approve or assign their system role.\n\nRegards,\n${appName} Automation System`;

  const portalUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  const membersDirectoryUrl = `${portalUrl}/#/employees`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
        .badge { display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); color: #ffffff; font-weight: 800; font-size: 11px; padding: 6px 14px; border-radius: 12px; letter-spacing: 1px; text-transform: uppercase; }
        .title { color: #0f172a; font-size: 20px; font-weight: 800; margin-top: 16px; margin-bottom: 8px; }
        .subtitle { color: #64748b; font-size: 13px; margin-bottom: 20px; }
        .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 20px 0; font-size: 13px; color: #334155; }
        .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
        .info-label { font-weight: 700; color: #64748b; }
        .info-val { font-weight: 800; color: #0f172a; }
        .approve-btn { display: block; width: fit-content; margin: 24px auto 0; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #ffffff !important; text-decoration: none; font-weight: 800; font-size: 15px; padding: 14px 36px; border-radius: 14px; text-align: center; letter-spacing: 0.3px; }
        .steps { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 16px 20px; margin: 20px 0; font-size: 13px; color: #166534; }
        .steps ol { margin: 8px 0 0 0; padding-left: 20px; line-height: 2; }
        .footer { font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="badge">MANAGER APPROVAL REQUIRED</div>
        <div class="title">New Account Registration Request</div>
        <div class="subtitle">A new team member has verified their email address and is requesting access to <strong>${appName}</strong>.</div>

        <div class="info-card">
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #9333ea; margin-bottom: 10px;">User Registration Details</div>
          <div class="info-row"><span class="info-label">Full Name:</span><span class="info-val">${newUser.name}</span></div>
          <div class="info-row"><span class="info-label">Work Email:</span><span class="info-val">${newUser.email}</span></div>
          <div class="info-row"><span class="info-label">Phone Number:</span><span class="info-val">${newUser.phone || 'N/A'}</span></div>
          <div class="info-row" style="border-bottom: none;"><span class="info-label">Department:</span><span class="info-val">${newUser.department || 'Influencer Marketing'}</span></div>
        </div>

        <div class="steps">
          <strong>How to approve this request:</strong>
          <ol>
            <li>Click the button below to open the portal</li>
            <li>Log in with your manager account</li>
            <li>In <strong>Members Directory</strong>, find the pending request at the top</li>
            <li>Click <strong>Approve</strong> and assign the employee role</li>
          </ol>
        </div>

        <a href="${membersDirectoryUrl}" class="approve-btn">Open Portal &amp; Approve Request &rarr;</a>

        <div class="footer">
          &copy; ${new Date().getFullYear()} ${appName}. Automated Notification.<br>
          <span style="font-size:11px;">Portal URL: <a href="${membersDirectoryUrl}">${membersDirectoryUrl}</a></span>
        </div>
      </div>
    </body>
    </html>
  `;

  for (const managerEmail of managerEmails) {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = getTransporter();
        await transporter.sendMail({
          from: `"${appName}" <${fromAddress}>`,
          to: managerEmail,
          subject: subject,
          text: textContent,
          html: htmlContent
        });
        console.log(`[SMTP Success] Delivered Manager Approval Email to: ${managerEmail}`);
        continue;
      } catch (smtpErr: any) {
        console.error(`[SMTP Error sending manager approval email to ${managerEmail}]:`, smtpErr?.message || smtpErr);
      }
    }

    console.log(`[MANAGER EMAIL NOTIFICATION] Manager: ${managerEmail} | New User: ${newUser.name} (${newUser.email})`);
  }

  return true;
};

export interface BrandAllotmentEmailPayload {
  applicationId?: string;
  influencerEmail: string;
  influencerName: string;
  brandName: string;
  collabType: 'Barter' | 'Paid' | 'Both';
  deliverables?: string;
  commercialAmount?: number;
  managerName?: string;
  notes?: string;
  influencerPhone?: string;
  acceptUrl?: string;
  rejectUrl?: string;
}

export const sendBrandAllotmentEmail = async (
  payload: BrandAllotmentEmailPayload
): Promise<boolean> => {
  const {
    applicationId,
    influencerEmail,
    influencerName,
    brandName,
    collabType,
    deliverables = '1 Dedicated Reel / Post + 1 Story',
    commercialAmount = 0,
    managerName = 'Campaign Operations Team',
    notes = '',
    influencerPhone = ''
  } = payload;

  const appName = (process.env.APP_NAME || 'Ad2ship Influencer Operations').trim();
  const fromAddress = (process.env.FROM_EMAIL || process.env.SMTP_USER || 'reena.lalwani@ad2ship.com').trim();
  const brandClean = (brandName || '').trim();
  const firstName = (influencerName || 'Creator').trim().split(' ')[0];

  // Informative, professional influencer collaboration subject line
  let subject = '';
  if (collabType === 'Paid') {
    subject = `Influencer Collaboration: ${brandClean} x ${influencerName} — Campaign Deliverables & Brief`;
  } else if (collabType === 'Barter') {
    subject = `Influencer PR Collaboration: ${brandClean} x ${influencerName} — Gifting & Content Deliverables`;
  } else {
    subject = `Influencer Collaboration: ${brandClean} x ${influencerName} — Campaign Brief & PR Gifting Details`;
  }

  // Build Accept and Reject Action URLs
  const backendBaseUrl = (
    process.env.BACKEND_URL || 
    process.env.API_URL || 
    (process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : 'https://media.ad2ship.com')
  ).replace(/\/$/, '');
  const acceptUrl = payload.acceptUrl || (applicationId 
    ? `${backendBaseUrl}/api/v1/influencer-applications/respond?id=${applicationId}&action=accept` 
    : '');
  const rejectUrl = payload.rejectUrl || (applicationId 
    ? `${backendBaseUrl}/api/v1/influencer-applications/respond?id=${applicationId}&action=reject` 
    : '');

  // Support WhatsApp number for creator inquiries
  const supportPhone = (process.env.SUPPORT_WHATSAPP_NUMBER || '918962442030').replace(/\D/g, '');
  const cleanPhoneFormatted = supportPhone.length === 10 ? `91${supportPhone}` : supportPhone;
  const whatsappReplyText = encodeURIComponent(`Hi, I received the collaboration invite for ${brandClean}. I have a question regarding the campaign: `);
  const whatsappCtaUrl = `https://wa.me/${cleanPhoneFormatted}?text=${whatsappReplyText}`;
  const communityInviteUrl = (process.env.COMMUNITY_WHATSAPP_URL || 'https://chat.whatsapp.com/LlDdZH5vdXi2Pbb1wCAymU?s=cl&p=a&iam=2').trim();

  const collabBadgeLabel = collabType === 'Both' ? 'Barter + Paid Collab' : (collabType === 'Paid' ? 'Paid Collab' : 'PR Gifting & Barter');

  const textContent = `Dear ${firstName},

We are pleased to inform you that our brand marketing team has reviewed your profile and shortlisted you for an official influencer campaign collaboration with ${brandClean}.

CAMPAIGN PARTICULARS & DELIVERABLES:
• Allotted Brand: ${brandClean}
• Collaboration Mode: ${collabBadgeLabel}
• Deliverables: ${deliverables}
• Campaign Manager: ${managerName}
${notes && notes.trim() ? `• Special Guidelines: ${notes.trim()}\n` : ''}
NEXT STEPS:
1. Accept Opportunity: Click the link below to confirm and secure your slot.
Accept: ${acceptUrl}
Decline: ${rejectUrl}
${whatsappCtaUrl ? `Have questions? Chat on WhatsApp: ${whatsappCtaUrl}\n` : ''}
✨ JOIN OUR INFLUENCER COMMUNITY:
Connect with fellow creators & get exclusive campaign alerts on WhatsApp:
${communityInviteUrl}

Best regards,
${managerName}
Ad2ship Creator Operations`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 28px 12px; background-color: #f8fafc; font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center">
        
        <!-- Main Email Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 12px rgba(15, 23, 42, 0.04);">
          
          <!-- Clean Refined Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 26px 28px; text-align: left;">
              <h1 style="margin: 0; font-family: 'Roboto', Arial, sans-serif; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.2px; line-height: 1.3;">
                Brand Collaboration Brief
              </h1>
              <div style="font-family: 'Roboto', Arial, sans-serif; font-size: 13px; color: #e0e7ff; margin-top: 4px; font-weight: 400;">
                Campaign details and deliverables for <strong>${brandClean}</strong>
              </div>
            </td>
          </tr>

          <!-- Body Container -->
          <tr>
            <td style="padding: 26px 28px 22px 28px;">
              
              <!-- Creator Greeting -->
              <div style="font-family: 'Roboto', Arial, sans-serif; font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">
                Dear ${firstName},
              </div>
              <p style="font-family: 'Roboto', Arial, sans-serif; font-size: 13.5px; color: #475569; line-height: 1.6; margin: 0 0 20px 0; font-weight: 400;">
                We are pleased to inform you that our brand marketing team has reviewed your profile and shortlisted you for an official campaign collaboration with <strong>${brandClean}</strong>. Please find the campaign specifications and deliverables outlined below.
              </p>

              <!-- Campaign Overview Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 20px;">
                <tr>
                  <td colspan="2" style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 10px 16px; font-family: 'Roboto', Arial, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b;">
                    Campaign Particulars &amp; Deliverables
                  </td>
                </tr>
                
                <!-- Row 1: Allotted Brand -->
                <tr>
                  <td width="38%" style="padding: 11px 16px; font-family: 'Roboto', Arial, sans-serif; font-size: 13px; font-weight: 400; color: #64748b; border-bottom: 1px solid #f1f5f9;">
                    Allotted Brand
                  </td>
                  <td width="62%" align="right" style="padding: 11px 16px; font-family: 'Roboto', Arial, sans-serif; font-size: 13.5px; font-weight: 600; color: #4338ca; border-bottom: 1px solid #f1f5f9; text-align: right;">
                    ${brandClean}
                  </td>
                </tr>

                <!-- Row 2: Collaboration Mode -->
                <tr>
                  <td width="38%" style="padding: 11px 16px; font-family: 'Roboto', Arial, sans-serif; font-size: 13px; font-weight: 400; color: #64748b; border-bottom: 1px solid #f1f5f9;">
                    Collaboration Mode
                  </td>
                  <td width="62%" align="right" style="padding: 11px 16px; border-bottom: 1px solid #f1f5f9; text-align: right;">
                    ${collabType === 'Both'
                      ? '<span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; font-family: \'Roboto\', Arial, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; background-color: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe;">Barter + Paid</span>'
                      : (collabType === 'Paid'
                        ? '<span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; font-family: \'Roboto\', Arial, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">Paid Collab</span>'
                        : '<span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; font-family: \'Roboto\', Arial, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">Barter PR Gifting</span>'
                      )}
                  </td>
                </tr>

                <!-- Row 3: Deliverables -->
                <tr>
                  <td width="38%" style="padding: 11px 16px; font-family: 'Roboto', Arial, sans-serif; font-size: 13px; font-weight: 400; color: #64748b; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                    Deliverables
                  </td>
                  <td width="62%" align="right" style="padding: 11px 16px; font-family: 'Roboto', Arial, sans-serif; font-size: 13px; font-weight: 500; color: #1e293b; border-bottom: 1px solid #f1f5f9; text-align: right; line-height: 1.5;">
                    ${deliverables}
                  </td>
                </tr>

                <!-- Row 4: Assigned Campaign Manager -->
                <tr>
                  <td width="38%" style="padding: 11px 16px; font-family: 'Roboto', Arial, sans-serif; font-size: 13px; font-weight: 400; color: #64748b;">
                    Campaign Manager
                  </td>
                  <td width="62%" align="right" style="padding: 11px 16px; font-family: 'Roboto', Arial, sans-serif; font-size: 13px; font-weight: 500; color: #1e293b; text-align: right;">
                    ${managerName}
                  </td>
                </tr>
              </table>

              <!-- Special Guidelines (if provided) -->
              ${notes && notes.trim() ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #6366f1; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <div style="font-family: 'Roboto', Arial, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: #4f46e5; margin-bottom: 3px;">
                      Special Guidelines &amp; Notes
                    </div>
                    <div style="font-family: 'Roboto', Arial, sans-serif; font-size: 12.5px; color: #334155; line-height: 1.5; font-weight: 400;">
                      ${notes.trim()}
                    </div>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Next Immediate Steps -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 22px; overflow: hidden;">
                <tr>
                  <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 10px 16px; font-family: 'Roboto', Arial, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b;">
                    Next Immediate Steps
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="22" style="vertical-align: top; padding-bottom: 10px;">
                          <div style="width: 18px; height: 18px; border-radius: 50%; background-color: #4f46e5; color: #ffffff; font-family: 'Roboto', Arial, sans-serif; font-size: 10px; font-weight: 600; text-align: center; line-height: 18px;">1</div>
                        </td>
                        <td style="vertical-align: top; padding-left: 8px; padding-bottom: 10px; font-family: 'Roboto', Arial, sans-serif; font-size: 12.5px; color: #475569; line-height: 1.5; font-weight: 400;">
                          <span style="font-weight: 600; color: #1e293b;">Confirm Availability:</span> Click <strong>Accept</strong> below to confirm and update our campaign roster.
                        </td>
                      </tr>
                      <tr>
                        <td width="22" style="vertical-align: top; padding-bottom: 10px;">
                          <div style="width: 18px; height: 18px; border-radius: 50%; background-color: #4f46e5; color: #ffffff; font-family: 'Roboto', Arial, sans-serif; font-size: 10px; font-weight: 600; text-align: center; line-height: 18px;">2</div>
                        </td>
                        <td style="vertical-align: top; padding-left: 8px; padding-bottom: 10px; font-family: 'Roboto', Arial, sans-serif; font-size: 12.5px; color: #475569; line-height: 1.5; font-weight: 400;">
                          <span style="font-weight: 600; color: #1e293b;">Creative Brief:</span> Your campaign manager (${managerName}) will share sample references, hooks, and script guidelines.
                        </td>
                      </tr>
                      <tr>
                        <td width="22" style="vertical-align: top;">
                          <div style="width: 18px; height: 18px; border-radius: 50%; background-color: #4f46e5; color: #ffffff; font-family: 'Roboto', Arial, sans-serif; font-size: 10px; font-weight: 600; text-align: center; line-height: 18px;">3</div>
                        </td>
                        <td style="vertical-align: top; padding-left: 8px; font-family: 'Roboto', Arial, sans-serif; font-size: 12.5px; color: #475569; line-height: 1.5; font-weight: 400;">
                          <span style="font-weight: 600; color: #1e293b;">Draft Review:</span> Share a quick draft preview of your content with your manager for review before posting live.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Buttons: Small, Professional Accept & Decline -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0 16px 0;">
                <tr>
                  <td align="center">
                    
                    <!-- Accept Button -->
                    <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; margin: 0 4px; vertical-align: middle;">
                      <tr>
                        <td align="center" style="border-radius: 6px; background-color: #16a34a;">
                          <a href="${acceptUrl}" target="_blank" style="display: inline-block; padding: 8px 24px; font-family: 'Roboto', Arial, sans-serif; font-size: 13px; font-weight: 600; color: #ffffff !important; text-decoration: none; border-radius: 6px; letter-spacing: 0.2px;">
                            Accept
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Decline Button -->
                    <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; margin: 0 4px; vertical-align: middle;">
                      <tr>
                        <td align="center" style="border-radius: 6px; background-color: #ffffff; border: 1px solid #cbd5e1;">
                          <a href="${rejectUrl}" target="_blank" style="display: inline-block; padding: 7px 20px; font-family: 'Roboto', Arial, sans-serif; font-size: 13px; font-weight: 500; color: #475569 !important; text-decoration: none; border-radius: 6px;">
                            Decline
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- WhatsApp Chat Assistance -->
              ${whatsappCtaUrl ? `
              <div style="text-align: center; margin-top: 10px;">
                <a href="${whatsappCtaUrl}" target="_blank" style="display: inline-block; font-family: 'Roboto', Arial, sans-serif; font-size: 12px; font-weight: 500; color: #047857; text-decoration: none; padding: 5px 12px; border-radius: 6px; background-color: #f0fdf4; border: 1px solid #bbf7d0;">
                  💬 Have questions? Chat on WhatsApp &rarr;
                </a>
              </div>
              ` : ''}

              <!-- Join Influencer Community Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; margin-top: 18px; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 18px; text-align: center;">
                    <div style="font-family: 'Roboto', Arial, sans-serif; font-size: 12.5px; font-weight: 600; color: #6b21a8; margin-bottom: 3px;">
                      Join Our Influencer Community
                    </div>
                    <div style="font-family: 'Roboto', Arial, sans-serif; font-size: 11.5px; color: #581c87; line-height: 1.5; margin-bottom: 10px; font-weight: 400;">
                      Connect with fellow creators, access new barter PR gifting drops, and receive upcoming campaign alerts.
                    </div>
                    <a href="${communityInviteUrl}" target="_blank" style="display: inline-block; background-color: #7c3aed; color: #ffffff !important; font-family: 'Roboto', Arial, sans-serif; font-size: 11.5px; font-weight: 600; text-decoration: none; padding: 7px 18px; border-radius: 6px; letter-spacing: 0.2px;">
                      Join Community on WhatsApp &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-family: 'Roboto', Arial, sans-serif; font-size: 11.5px; color: #94a3b8; line-height: 1.5; margin: 16px 0 0 0; text-align: center; font-weight: 400;">
                If you have schedule conflicts, you can simply reply directly to this email.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center;">
              <div style="font-family: 'Roboto', Arial, sans-serif; font-size: 11.5px; color: #64748b; line-height: 1.5; font-weight: 400;">
                Best regards,<br>
                &copy; ${new Date().getFullYear()} ${appName} &bull; Creator Operations &amp; Brand Logistics Hub
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;

  // 1. Primary: SMTP via Nodemailer
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = getTransporter();
      const info = await transporter.sendMail({
        from: `"${appName}" <${fromAddress}>`,
        to: influencerEmail,
        subject: subject,
        text: textContent,
        html: htmlContent
      });

      console.log(`[SMTP Success] Brand allotment email delivered to ${influencerEmail} (MessageId: ${info.messageId})`);
      return true;
    } catch (smtpErr: any) {
      console.error(`[SMTP Error sending brand allotment email to ${influencerEmail}]:`, smtpErr?.message || smtpErr);
    }
  }

  // 2. Secondary Webhook Fallback
  const webhookUrl = (process.env.GMAIL_WEBHOOK_URL || '').trim();
  if (webhookUrl && webhookUrl.includes('script.google.com')) {
    try {
      const webhookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow',
        body: JSON.stringify({
          to: influencerEmail,
          subject: subject,
          text: textContent,
          html: htmlContent
        })
      });

      if (webhookRes.ok || webhookRes.status === 200 || webhookRes.status === 302) {
        console.log(`[Webhook Success] Brand allotment email delivered to ${influencerEmail}`);
        return true;
      }
    } catch (webhookErr: any) {
      console.error(`[Webhook Error]`, webhookErr?.message || webhookErr);
    }
  }

  console.log(`\n=================================================`);
  console.log(`[BRAND ALLOTMENT EMAIL SIMULATION]`);
  console.log(`To: ${influencerEmail} (${influencerName})`);
  console.log(`Brand: ${brandClean} | Collab: ${collabType} | Deliverables: ${deliverables}`);
  console.log(`Accept URL: ${acceptUrl}`);
  console.log(`Reject URL: ${rejectUrl}`);
  console.log(`=================================================\n`);
  return true;
};
