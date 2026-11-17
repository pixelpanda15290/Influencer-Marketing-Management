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
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
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
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
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
  influencerEmail: string;
  influencerName: string;
  brandName: string;
  collabType: 'Barter' | 'Paid' | 'Both';
  deliverables?: string;
  commercialAmount?: number;
  managerName?: string;
  notes?: string;
  influencerPhone?: string;
}

export const sendBrandAllotmentEmail = async (
  payload: BrandAllotmentEmailPayload
): Promise<boolean> => {
  const {
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
  const subject = `Campaign Allotment Confirmation: ${brandName} x ${influencerName}`;

  // Clean phone number for WhatsApp link
  const cleanPhone = (influencerPhone || '').replace(/\D/g, '');
  const cleanPhoneFormatted = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const whatsappReplyText = encodeURIComponent(`Hi ${managerName}, I have received the official campaign allotment email for ${brandName}. I confirm my availability & accept the collaboration!`);
  const whatsappCtaUrl = cleanPhoneFormatted ? `https://wa.me/${cleanPhoneFormatted}?text=${whatsappReplyText}` : '';

  const textContent = `Hello ${influencerName},

Congratulations! We are pleased to inform you that you have been shortlisted and officially allotted for an exclusive influencer collaboration with ${brandName}.

CAMPAIGN SPECIFICATIONS:
• Allotted Brand: ${brandName}
• Collaboration Mode: ${collabType === 'Both' ? 'Barter + Paid' : `${collabType} Collab`}
• Deliverables: ${deliverables}
${(collabType === 'Paid' || collabType === 'Both') && commercialAmount > 0 ? `• Commercial Compensation: ₹${commercialAmount.toLocaleString('en-IN')} INR\n` : ''}• Campaign Manager: ${managerName}
${notes ? `• Special Guidelines/Notes: ${notes}\n` : ''}

NEXT IMMEDIATE STEPS:
1. Confirm Availability: Reply directly to this email or confirm on WhatsApp.
${collabType === 'Paid'
  ? '2. Creative Brief: Your campaign manager will share sample hooks, references, and script requirements.'
  : '2. PR Parcel Dispatch: Our logistics team is scheduling product parcel dispatch to your delivery address.'}
3. Draft Approval: Submit draft video/story link for review prior to going live.
${(collabType === 'Paid' || collabType === 'Both') && commercialAmount > 0 ? `4. Commercial Payout: Payout of ₹${commercialAmount.toLocaleString('en-IN')} INR will be disbursed upon live post verification.\n` : ''}
If you have any questions, please reply directly to this email.

Warm regards,
${managerName}
Ad2ship Influencer Operations Hub`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${subject}</title>
      <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      </style>
    </head>
    <body style="margin: 0; padding: 32px 16px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      
      <!-- Outer Centered Container Table -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9;">
        <tr>
          <td align="center">
            
            <!-- Main Email Card (Max 600px) -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);">
              
              <!-- 1. Executive Top Header (Clean Deep Navy Slate) -->
              <tr>
                <td style="background-color: #0f172a; padding: 32px 32px 28px 32px; text-align: left;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td>
                        <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #818cf8; margin-bottom: 8px;">
                          AD2SHIP &bull; INFLUENCER OPERATIONS
                        </div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.4px; line-height: 1.3;">
                          Official Campaign Allocation Notice
                        </h1>
                        <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; font-weight: 500;">
                          Campaign confirmation &amp; deliverables for <strong>${brandName}</strong>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- 2. Email Body Content -->
              <tr>
                <td style="padding: 32px;">
                  
                  <!-- Greeting & Opening -->
                  <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">
                    Dear ${influencerName},
                  </div>
                  <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                    We are pleased to inform you that our brand marketing team has reviewed your profile and shortlisted you for an official influencer marketing collaboration with <strong>${brandName}</strong>.
                  </p>

                  <!-- 3. Campaign Specifications Table (Bulletproof Gmail 2-Column Table) -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                    <tr>
                      <td colspan="2" style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px 18px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #475569;">
                        Campaign Particulars
                      </td>
                    </tr>
                    
                    <!-- Row 1: Allotted Brand -->
                    <tr>
                      <td width="38%" style="padding: 13px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">
                        Allotted Brand
                      </td>
                      <td width="62%" align="right" style="padding: 13px 18px; font-size: 14px; font-weight: 800; color: #4f46e5; border-bottom: 1px solid #f1f5f9; text-align: right;">
                        ${brandName}
                      </td>
                    </tr>

                    <!-- Row 2: Collaboration Mode -->
                    <tr>
                      <td width="38%" style="padding: 13px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">
                        Collaboration Mode
                      </td>
                      <td width="62%" align="right" style="padding: 13px 18px; border-bottom: 1px solid #f1f5f9; text-align: right;">
                        ${collabType === 'Both'
                          ? '<span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; background-color: #f5f3ff; color: #6b21a8; border: 1px solid #ddd6fe;">Barter + Paid</span>'
                          : (collabType === 'Paid'
                            ? '<span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">Paid Collab</span>'
                            : '<span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">Barter PR Gifting</span>'
                          )}
                      </td>
                    </tr>

                    <!-- Row 3: Campaign Deliverables -->
                    <tr>
                      <td width="38%" style="padding: 13px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                        Deliverables
                      </td>
                      <td width="62%" align="right" style="padding: 13px 18px; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9; text-align: right; line-height: 1.5;">
                        ${deliverables}
                      </td>
                    </tr>

                    <!-- Row 4: Commercial Compensation (if applicable) -->
                    ${(collabType === 'Paid' || collabType === 'Both') && commercialAmount > 0 ? `
                    <tr>
                      <td width="38%" style="padding: 13px 18px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">
                        Commercial Payout
                      </td>
                      <td width="62%" align="right" style="padding: 13px 18px; font-size: 14px; font-weight: 800; color: #059669; border-bottom: 1px solid #f1f5f9; text-align: right;">
                        ₹${commercialAmount.toLocaleString('en-IN')} INR
                      </td>
                    </tr>
                    ` : ''}

                    <!-- Row 5: Assigned Campaign Manager -->
                    <tr>
                      <td width="38%" style="padding: 13px 18px; font-size: 13px; font-weight: 600; color: #64748b;">
                        Assigned Manager
                      </td>
                      <td width="62%" align="right" style="padding: 13px 18px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right;">
                        ${managerName}
                      </td>
                    </tr>
                  </table>

                  <!-- 4. Special Guidelines & Manager Notes (Executive Callout Box) -->
                  ${notes && notes.trim() ? `
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #6366f1; border-radius: 8px; margin-bottom: 24px;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #4338ca; margin-bottom: 6px;">
                          Special Guidelines &amp; Notes
                        </div>
                        <div style="font-size: 13px; color: #334155; line-height: 1.5; font-weight: 500;">
                          ${notes.trim()}
                        </div>
                      </td>
                    </tr>
                  </table>
                  ` : ''}

                  <!-- 5. Next Immediate Steps (Clean Numbered Sequence) -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 28px; overflow: hidden;">
                    <tr>
                      <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px 18px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #475569;">
                        Next Immediate Steps
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 18px 20px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          
                          <!-- Step 1 -->
                          <tr>
                            <td width="28" style="vertical-align: top; padding-bottom: 14px;">
                              <div style="width: 22px; height: 22px; border-radius: 50%; background-color: #4f46e5; color: #ffffff; font-size: 11px; font-weight: 800; text-align: center; line-height: 22px;">1</div>
                            </td>
                            <td style="vertical-align: top; padding-left: 10px; padding-bottom: 14px; font-size: 13px; color: #334155; line-height: 1.5;">
                              <strong style="color: #0f172a;">Confirm Availability:</strong> Reply directly to this email or confirm on WhatsApp to lock in your campaign slot.
                            </td>
                          </tr>

                          <!-- Step 2 -->
                          <tr>
                            <td width="28" style="vertical-align: top; padding-bottom: 14px;">
                              <div style="width: 22px; height: 22px; border-radius: 50%; background-color: #4f46e5; color: #ffffff; font-size: 11px; font-weight: 800; text-align: center; line-height: 22px;">2</div>
                            </td>
                            <td style="vertical-align: top; padding-left: 10px; padding-bottom: 14px; font-size: 13px; color: #334155; line-height: 1.5;">
                              ${collabType === 'Paid'
                                ? '<strong style="color: #0f172a;">Creative Brief:</strong> Your campaign manager will share sample hooks, references, and script requirements.'
                                : '<strong style="color: #0f172a;">PR Parcel Dispatch:</strong> Our logistics department is scheduling product parcel dispatch to your registered delivery address.'}
                            </td>
                          </tr>

                          <!-- Step 3 -->
                          <tr>
                            <td width="28" style="vertical-align: top; padding-bottom: ${(collabType === 'Paid' || collabType === 'Both') && commercialAmount > 0 ? '14px' : '0'};">
                              <div style="width: 22px; height: 22px; border-radius: 50%; background-color: #4f46e5; color: #ffffff; font-size: 11px; font-weight: 800; text-align: center; line-height: 22px;">3</div>
                            </td>
                            <td style="vertical-align: top; padding-left: 10px; padding-bottom: ${(collabType === 'Paid' || collabType === 'Both') && commercialAmount > 0 ? '14px' : '0'}; font-size: 13px; color: #334155; line-height: 1.5;">
                              <strong style="color: #0f172a;">Draft Approval:</strong> Submit draft video/story link for review prior to going live.
                            </td>
                          </tr>

                          <!-- Step 4 (if Paid or Both) -->
                          ${(collabType === 'Paid' || collabType === 'Both') && commercialAmount > 0 ? `
                          <tr>
                            <td width="28" style="vertical-align: top;">
                              <div style="width: 22px; height: 22px; border-radius: 50%; background-color: #059669; color: #ffffff; font-size: 11px; font-weight: 800; text-align: center; line-height: 22px;">4</div>
                            </td>
                            <td style="vertical-align: top; padding-left: 10px; font-size: 13px; color: #334155; line-height: 1.5;">
                              <strong style="color: #0f172a;">Commercial Payout:</strong> Payout of ₹${commercialAmount.toLocaleString('en-IN')} INR processed upon live link verification.
                            </td>
                          </tr>
                          ` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- 6. Confirmation Call To Action -->
                  ${whatsappCtaUrl ? `
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                    <tr>
                      <td align="center">
                        <a href="${whatsappCtaUrl}" target="_blank" style="display: inline-block; background-color: #16a34a; background: linear-gradient(135deg, #16a34a 0%, #059669 100%); color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 800; padding: 13px 32px; border-radius: 10px; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.25);">
                          Confirm Collaboration on WhatsApp &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                  ` : ''}

                  <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0; text-align: center;">
                    If you have any questions or schedule conflicts, simply reply directly to this email.
                  </p>
                </td>
              </tr>

              <!-- 7. Corporate Footer -->
              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
                  <div style="font-size: 12px; color: #64748b; line-height: 1.6;">
                    &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.<br>
                    Official campaign allocation dispatched via <strong>Ad2ship Influencer Operations Hub</strong>.
                  </div>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

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
  console.log(`Brand: ${brandName} | Collab: ${collabType} | Deliverables: ${deliverables}`);
  console.log(`=================================================\n`);
  return true;
};

