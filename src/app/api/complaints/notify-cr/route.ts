import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import webpush from "web-push";

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BL6beoPR-UqUenGX5ZkwFG1FliiSuXuIvn4mJf58kqJvLu92bjg90ShWSbbfgi_nR6dpI0koxL0p7CghEeqpMmI";

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "vqecIj60gnebtVEz3vxZAf-SR5HdiZ9VPdeSfHGzdSU";

const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:psreyas09@gmail.com";

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.warn("Failed to configure VAPID details:", err);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const headerUserId = request.headers.get("x-user-id");
    const headerUserEmail = request.headers.get("x-user-email");

    if (!user && !headerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, category, description, displayName, isAnonymous, studentEmail: clientProvidedEmail } = body;

    if (!title || !category || !description) {
      return NextResponse.json(
        { error: "Missing required complaint fields" },
        { status: 400 }
      );
    }

    const appName = process.env.NEXT_PUBLIC_APP_NAME || "ClassDesk";
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://class-chi-topaz.vercel.app";

    // 2. Identify the student who registered the complaint
    const studentEmail = (
      clientProvidedEmail ||
      user?.email ||
      headerUserEmail ||
      ""
    ).trim().toLowerCase();

    // 3. Retrieve all CR & Admin emails with multiple fallbacks
    const crEmailsSet = new Set<string>();

    // Fallback A: Query get_cr_notification_emails RPC
    try {
      const { data: crRows, error: rpcError } = await supabase.rpc(
        "get_cr_notification_emails"
      );
      if (!rpcError && Array.isArray(crRows)) {
        for (const item of crRows) {
          const email = (
            typeof item === "string" ? item : item?.email
          )
            ?.trim()
            .toLowerCase();
          if (email && email.includes("@")) {
            crEmailsSet.add(email);
          }
        }
      }
    } catch (err) {
      console.warn("RPC get_cr_notification_emails error:", err);
    }

    // Fallback B: Query admins table directly
    try {
      const { data: admins } = await supabase.from("admins").select("email");
      if (Array.isArray(admins)) {
        for (const a of admins) {
          const email = a.email?.trim().toLowerCase();
          if (email && email.includes("@")) {
            crEmailsSet.add(email);
          }
        }
      }
    } catch {
      // Ignored if RLS restricts regular users
    }

    // Fallback C: Query admin_get_cr_list RPC
    try {
      const { data: crList } = await supabase.rpc("admin_get_cr_list");
      if (Array.isArray(crList)) {
        for (const cr of crList) {
          const email = cr?.email?.trim().toLowerCase();
          if (email && email.includes("@")) {
            crEmailsSet.add(email);
          }
        }
      }
    } catch {
      // Ignored if restricted
    }

    // Always include Primary Admin
    crEmailsSet.add("psreyas09@gmail.com");

    const crEmails = Array.from(crEmailsSet);
    console.log(`[notify-cr] Target CR recipients:`, crEmails);
    console.log(`[notify-cr] Target student submitter:`, studentEmail);

    const submitterLabel = isAnonymous
      ? "Anonymous Student (Confidential)"
      : displayName || "A student";

    let crEmailsSent = 0;
    let studentEmailSent = false;
    let pushSent = 0;

    const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
    const resendApiKey = process.env.RESEND_API_KEY;

    if ((gmailUser && gmailPass) || resendApiKey) {
      // =======================================================================
      // EMAIL 1: Notification to Class Representatives (CRs)
      // =======================================================================
      const crEmailSubject = `[${appName}] New Complaint: [${category}] ${title}`;
      const crHtmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fbfbf9; color: #18181b; padding: 24px; margin: 0; }
              .container { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; }
              .header { background: #18181b; color: #ffffff; padding: 18px 24px; }
              .header h1 { margin: 0; font-size: 15px; font-weight: 600; }
              .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; margin-bottom: 8px; }
              .content { padding: 24px; }
              .title { font-size: 18px; font-weight: 700; color: #09090b; margin: 0 0 12px 0; }
              .meta { font-size: 13px; color: #52525b; margin: 6px 0; }
              .desc-box { background: #f4f4f5; border-left: 3px solid #ef4444; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #27272a; line-height: 1.5; white-space: pre-wrap; }
              .btn { display: inline-block; background: #18181b; color: #ffffff !important; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; margin-top: 16px; }
              .footer { padding: 16px 24px; background: #fafafa; border-top: 1px solid #f4f4f5; font-size: 11px; color: #71717a; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${appName} • CR Attention Required</h1>
              </div>
              <div class="content">
                <span class="badge">New Complaint • ${category}</span>
                <h2 class="title">${title}</h2>
                <div class="meta"><strong>Submitted By:</strong> ${submitterLabel}</div>
                <div class="meta"><strong>Category:</strong> ${category}</div>
                <div class="desc-box"><strong>Description:</strong><br/>${description}</div>
                <div style="text-align: center;">
                  <a href="${appUrl}/admin" class="btn">Open Admin Desk to Review</a>
                </div>
              </div>
              <div class="footer">
                Notification sent automatically to Class Representatives.
              </div>
            </div>
          </body>
        </html>
      `;

      // =======================================================================
      // EMAIL 2: Confirmation to the Student who Registered the Complaint
      // =======================================================================
      const studentEmailSubject = `[${appName}] Complaint Registered: "${title}"`;
      const studentHtmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fbfbf9; color: #18181b; padding: 24px; margin: 0; }
              .container { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; }
              .header { background: #18181b; color: #ffffff; padding: 18px 24px; }
              .header h1 { margin: 0; font-size: 15px; font-weight: 600; }
              .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; margin-bottom: 8px; }
              .content { padding: 24px; }
              .title { font-size: 18px; font-weight: 700; color: #09090b; margin: 0 0 12px 0; }
              .meta { font-size: 13px; color: #52525b; margin: 6px 0; }
              .desc-box { background: #f4f4f5; border-left: 3px solid #10b981; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #27272a; line-height: 1.5; white-space: pre-wrap; }
              .btn { display: inline-block; background: #18181b; color: #ffffff !important; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; margin-top: 16px; }
              .footer { padding: 16px 24px; background: #fafafa; border-top: 1px solid #f4f4f5; font-size: 11px; color: #71717a; text-align: center; }
              .confidential-box { margin-top: 16px; padding: 10px 14px; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 6px; font-size: 11px; color: #4b5563; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${appName} • Complaint Submitted</h1>
              </div>
              <div class="content">
                <span class="badge">Status: Open • Received</span>
                <h2 class="title">${title}</h2>
                <div class="meta"><strong>Category:</strong> ${category}</div>
                <div class="desc-box"><strong>Your Description:</strong><br/>${description}</div>

                <div class="confidential-box">
                  ${
                    isAnonymous
                      ? "🔒 <strong>Anonymous Submission:</strong> Your name and email are kept strictly confidential and will never be shown to classmates."
                      : "✅ <strong>Submitted:</strong> Your complaint has been forwarded to Class Representatives."
                  }
                  <br/><br/>
                  You will receive an automated email as soon as a Class Representative updates the status or leaves a response.
                </div>

                <div style="text-align: center;">
                  <a href="${appUrl}/complaints" class="btn">View in Complaints Desk</a>
                </div>
              </div>
              <div class="footer">
                This is an automated confirmation sent from ${appName}.
              </div>
            </div>
          </body>
        </html>
      `;

      if (gmailUser && gmailPass) {
        try {
          const nodemailer = await import("nodemailer");
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: gmailUser,
              pass: gmailPass,
            },
          });

          // Send to all CR accounts
          for (const recipient of crEmails) {
            try {
              await transporter.sendMail({
                from: `"${appName}" <${gmailUser}>`,
                to: recipient,
                subject: crEmailSubject,
                html: crHtmlContent,
              });
              crEmailsSent++;
              console.log(`[notify-cr] CR alert sent to: ${recipient}`);
            } catch (err) {
              console.error(`[notify-cr] Failed to send to CR ${recipient}:`, err);
            }
          }

          // Send to the student who submitted the complaint
          if (studentEmail && studentEmail.includes("@")) {
            try {
              await transporter.sendMail({
                from: `"${appName}" <${gmailUser}>`,
                to: studentEmail,
                subject: studentEmailSubject,
                html: studentHtmlContent,
              });
              studentEmailSent = true;
              console.log(`[notify-cr] Submitter confirmation sent to: ${studentEmail}`);
            } catch (err) {
              console.error(`[notify-cr] Failed to send to student ${studentEmail}:`, err);
            }
          }
        } catch (err) {
          console.error("[notify-cr] Gmail SMTP error:", err);
        }
      } else if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);
          const fromEmail =
            process.env.RESEND_FROM_EMAIL || "ClassDesk <onboarding@resend.dev>";

          // Send to CRs
          for (const recipient of crEmails) {
            try {
              await resend.emails.send({
                from: fromEmail,
                to: recipient,
                subject: crEmailSubject,
                html: crHtmlContent,
              });
              crEmailsSent++;
            } catch (err) {
              console.error(`[notify-cr] Resend failed for CR ${recipient}:`, err);
            }
          }

          // Send to student
          if (studentEmail && studentEmail.includes("@")) {
            try {
              await resend.emails.send({
                from: fromEmail,
                to: studentEmail,
                subject: studentEmailSubject,
                html: studentHtmlContent,
              });
              studentEmailSent = true;
            } catch (err) {
              console.error(`[notify-cr] Resend failed for student ${studentEmail}:`, err);
            }
          }
        } catch (err) {
          console.error("[notify-cr] Resend error:", err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      crEmailsSent,
      studentEmailSent,
      crCount: crEmails.length,
      recipients: crEmails,
      student: studentEmail,
    });
  } catch (err: unknown) {
    console.error("[notify-cr] Unhandled error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
