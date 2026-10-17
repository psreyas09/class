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
    if (!user && !headerUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, category, description, displayName, isAnonymous } = body;

    if (!title || !category || !description) {
      return NextResponse.json(
        { error: "Missing required complaint fields" },
        { status: 400 }
      );
    }

    const appName = process.env.NEXT_PUBLIC_APP_NAME || "ClassDesk";
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://class-chi-topaz.vercel.app";

    // 2. Retrieve all CR & Admin emails with complete fallbacks
    const crEmailsSet = new Set<string>();

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

    // Try fetching from admins table directly
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

    // Always include Primary Admin
    crEmailsSet.add("psreyas09@gmail.com");

    const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
    const resendApiKey = process.env.RESEND_API_KEY;

    // If configured Gmail account has an email address, ensure it's in the recipient list
    if (gmailUser && gmailUser.includes("@")) {
      crEmailsSet.add(gmailUser.trim().toLowerCase());
    }

    const crEmails = Array.from(crEmailsSet);
    console.log(`[notify-cr] Sending complaint alert to:`, crEmails);

    const submitterLabel = isAnonymous
      ? "Anonymous Student (Confidential)"
      : displayName || "A student";

    let emailsSent = 0;
    let pushSent = 0;

    // 3. Send Email Alerts to CRs
    if ((gmailUser && gmailPass) || resendApiKey) {
      const emailSubject = `[${appName}] New Complaint: [${category}] ${title}`;

      const htmlContent = `
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

          for (const recipient of crEmails) {
            try {
              await transporter.sendMail({
                from: `"${appName}" <${gmailUser}>`,
                to: recipient,
                subject: emailSubject,
                html: htmlContent,
              });
              emailsSent++;
              console.log(`[notify-cr] Email successfully sent to ${recipient}`);
            } catch (err) {
              console.error(`[notify-cr] Failed to send email to ${recipient}:`, err);
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

          for (const recipient of crEmails) {
            try {
              await resend.emails.send({
                from: fromEmail,
                to: recipient,
                subject: emailSubject,
                html: htmlContent,
              });
              emailsSent++;
            } catch (err) {
              console.error(`[notify-cr] Resend failed for ${recipient}:`, err);
            }
          }
        } catch (err) {
          console.error("[notify-cr] Resend error:", err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      emailsSent,
      pushSent,
      crCount: crEmails.length,
      recipients: crEmails,
    });
  } catch (err: unknown) {
    console.error("[notify-cr] Unhandled error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
