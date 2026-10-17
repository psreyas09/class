import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import webpush from "web-push";
import { formatKolkataDateTime } from "@/lib/date-utils";

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

    // 1. Verify user is Admin or CR
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isPrimary = user.email?.toLowerCase() === "psreyas09@gmail.com";
    if (!isPrimary) {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { title, subject, type, due_at, link, description, isUpdate } = body;

    if (!title || !subject || !due_at) {
      return NextResponse.json(
        { error: "Missing required task fields" },
        { status: 400 }
      );
    }

    const formattedDue = formatKolkataDateTime(due_at);
    const appName = process.env.NEXT_PUBLIC_APP_NAME || "ClassDesk";
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://class-chi-topaz.vercel.app";

    let emailsSent = 0;
    let pushSent = 0;

    // =========================================================================
    // OPTION 1: Email Broadcast (Supports Gmail SMTP or Resend)
    // =========================================================================
    const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
    const resendApiKey = process.env.RESEND_API_KEY;

    if ((gmailUser && gmailPass) || resendApiKey) {
      try {
        // Fetch all verified student emails from profiles
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("is_approved", true);

        const recipients = (profiles || [])
          .map((p) => p.email?.trim().toLowerCase())
          .filter((e): e is string => !!e && e.includes("@"));

        if (recipients.length > 0) {
          const actionSubject = `[${appName}] ${isUpdate ? "Updated" : "New"} ${type}: ${subject} - ${title}`;
          const headerTitle = `${appName} • ${isUpdate ? "Task Revision Update" : "Classroom Alert"}`;
          const badgeText = isUpdate ? `Updated ${type}` : type;
          const badgeStyle = isUpdate
            ? "background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;"
            : "background: #fef3c7; color: #92400e;";

          const htmlContent = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fbfbf9; color: #18181b; padding: 24px; margin: 0; }
                  .container { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; }
                  .header { background: #18181b; color: #ffffff; padding: 18px 24px; }
                  .header h1 { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -0.02em; }
                  .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-bottom: 8px; }
                  .content { padding: 24px; }
                  .task-title { font-size: 18px; font-weight: 700; color: #09090b; margin: 0 0 12px 0; }
                  .meta-row { font-size: 13px; color: #52525b; margin: 6px 0; }
                  .meta-row strong { color: #18181b; }
                  .desc-box { background: #f4f4f5; border-left: 3px solid #d97706; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #27272a; line-height: 1.5; white-space: pre-wrap; }
                  .btn { display: inline-block; background: #18181b; color: #ffffff !important; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; margin-top: 16px; }
                  .footer { padding: 16px 24px; background: #fafafa; border-top: 1px solid #f4f4f5; font-size: 11px; color: #71717a; text-align: center; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>${headerTitle}</h1>
                  </div>
                  <div class="content">
                    <span class="badge" style="${badgeStyle}">${badgeText}</span>
                    <h2 class="task-title">${title}</h2>
                    <div class="meta-row"><strong>Subject:</strong> ${subject}</div>
                    <div class="meta-row"><strong>Due Date:</strong> ${formattedDue}</div>
                    ${
                      description
                        ? `<div class="desc-box"><strong>Instructions:</strong><br/>${description}</div>`
                        : ""
                    }
                    ${
                      link
                        ? `<div class="meta-row"><strong>Resource Link:</strong> <a href="${link}" style="color: #d97706;">${link}</a></div>`
                        : ""
                    }
                    <div style="text-align: center;">
                      <a href="${appUrl}" class="btn">View on Dashboard</a>
                    </div>
                  </div>
                  <div class="footer">
                    Sent automatically from ${appName} to verified classmates.
                  </div>
                </div>
              </body>
            </html>
          `;

          // Prioritize Gmail SMTP (Sends to ALL emails without needing a domain)
          if (gmailUser && gmailPass) {
            const nodemailer = await import("nodemailer");
            const transporter = nodemailer.createTransport({
              service: "gmail",
              auth: {
                user: gmailUser,
                pass: gmailPass,
              },
            });

            for (const recipient of recipients) {
              try {
                await transporter.sendMail({
                  from: `"${appName}" <${gmailUser}>`,
                  to: recipient,
                  subject: actionSubject,
                  html: htmlContent,
                });
                emailsSent++;
              } catch (err) {
                console.error(`Gmail SMTP send failed for ${recipient}:`, err);
              }
            }
          } else if (resendApiKey) {
            // Fallback to Resend
            const resend = new Resend(resendApiKey);
            const fromEmail =
              process.env.RESEND_FROM_EMAIL || "ClassDesk <onboarding@resend.dev>";

            for (const recipient of recipients) {
              try {
                await resend.emails.send({
                  from: fromEmail,
                  to: recipient,
                  subject: actionSubject,
                  html: htmlContent,
                });
                emailsSent++;
              } catch (err) {
                console.error(`Resend send failed for ${recipient}:`, err);
              }
            }
          }
        }
      } catch (err) {
        console.error("Email broadcast error:", err);
      }
    } else {
      console.info("Neither Gmail SMTP nor Resend configured. Skipping email broadcast.");
    }

    // =========================================================================
    // OPTION 3: Web Push Notification Broadcast
    // =========================================================================
    try {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth");

      if (subs && subs.length > 0) {
        const payload = JSON.stringify({
          title: `${isUpdate ? "Updated Task" : "New Task"}: ${subject}`,
          body: `${title} • Due ${formattedDue}${isUpdate ? " (Updated)" : ""}`,
          url: "/",
          tag: `task-${Date.now()}`,
        });

        const expiredSubIds: string[] = [];

        await Promise.all(
          subs.map(async (sub) => {
            const pushConfig = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            };

            try {
              await webpush.sendNotification(pushConfig, payload);
              pushSent++;
            } catch (err: unknown) {
              // If subscription is 404 or 410, it's expired/unregistered
              const statusCode = (err as { statusCode?: number })?.statusCode;
              if (statusCode === 404 || statusCode === 410) {
                expiredSubIds.push(sub.id);
              } else {
                console.warn("Failed to push to subscription:", sub.endpoint, err);
              }
            }
          })
        );

        // Clean up expired subscriptions
        if (expiredSubIds.length > 0) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .in("id", expiredSubIds);
        }
      }
    } catch (err) {
      console.error("Web Push broadcast error:", err);
    }

    return NextResponse.json({
      success: true,
      emailsSent,
      pushSent,
      hasResendKey: !!resendApiKey,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
