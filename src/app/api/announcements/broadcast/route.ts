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

    // 1. Verify user is authenticated and is Admin / CR
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
        return NextResponse.json(
          { error: "Forbidden: Admins only" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const {
      title,
      message,
      priority = "normal",
      link,
      sendEmail = true,
      sendPush = true,
      targetAll = true,
      targetUserIds = [],
    } = body;

    const trimmedTitle = title?.trim();
    const trimmedMessage = message?.trim();

    if (!trimmedTitle || !trimmedMessage) {
      return NextResponse.json(
        { error: "Missing required fields (title, message)" },
        { status: 400 }
      );
    }

    const appName = process.env.NEXT_PUBLIC_APP_NAME || "ClassDesk";
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://class-chi-topaz.vercel.app";
    const currentDateTime = formatKolkataDateTime(new Date().toISOString());

    const senderName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Class Representative";
    const senderEmail = user.email || "";

    // 2. Resolve Target Audience
    let query = supabase.from("profiles").select("id, email, full_name");

    if (targetAll) {
      query = query.eq("is_approved", true);
    } else {
      if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
        return NextResponse.json(
          { error: "Please select at least one student recipient." },
          { status: 400 }
        );
      }
      query = query.in("id", targetUserIds);
    }

    const { data: targetProfiles, error: profileErr } = await query;
    if (profileErr) {
      return NextResponse.json(
        { error: `Failed to fetch recipients: ${profileErr.message}` },
        { status: 500 }
      );
    }

    const recipients = (targetProfiles || [])
      .map((p) => ({
        id: p.id,
        email: p.email?.trim().toLowerCase(),
        name: p.full_name || p.email?.split("@")[0] || "Classmate",
      }))
      .filter((r): r is { id: string; email: string; name: string } =>
        Boolean(r.email && r.email.includes("@"))
      );

    const targetUserIdsList = recipients.map((r) => r.id);

    let emailsSent = 0;
    let pushSent = 0;

    // 3. Email Notification Broadcast
    if (sendEmail && recipients.length > 0) {
      const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
      const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
      const resendApiKey = process.env.RESEND_API_KEY;

      const priorityLabel =
        priority === "urgent"
          ? "🚨 URGENT ANNOUNCEMENT"
          : priority === "important"
          ? "⭐ IMPORTANT ANNOUNCEMENT"
          : "📢 CLASSROOM ANNOUNCEMENT";

      const priorityBg =
        priority === "urgent"
          ? "#dc2626"
          : priority === "important"
          ? "#d97706"
          : "#18181b";

      const badgeBg =
        priority === "urgent"
          ? "background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;"
          : priority === "important"
          ? "background: #fffbeb; color: #92400e; border: 1px solid #fde68a;"
          : "background: #f4f4f5; color: #27272a; border: 1px solid #e4e4e7;";

      const subjectLine = `[${appName}] ${
        priority === "urgent" ? "🚨 Urgent: " : priority === "important" ? "⭐ " : ""
      }${trimmedTitle}`;

      const safeLink = link?.trim() || "";

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fbfbf9; color: #18181b; padding: 24px; margin: 0; }
              .container { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
              .header { background: ${priorityBg}; color: #ffffff; padding: 18px 24px; }
              .header h1 { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; }
              .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 4px; margin-bottom: 12px; }
              .content { padding: 24px; }
              .announcement-title { font-size: 20px; font-weight: 700; color: #09090b; margin: 0 0 12px 0; line-height: 1.3; }
              .sender-bar { font-size: 12px; color: #71717a; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #f4f4f5; }
              .sender-bar strong { color: #18181b; }
              .message-body { background: #fafafa; border-left: 4px solid ${priorityBg}; padding: 16px 18px; margin: 16px 0; font-size: 14px; color: #27272a; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
              .link-box { margin: 20px 0; padding: 12px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 13px; color: #166534; }
              .link-box a { color: #15803d; font-weight: 600; word-break: break-all; }
              .actions { text-align: center; margin: 24px 0 8px 0; }
              .btn { display: inline-block; background: #18181b; color: #ffffff !important; text-decoration: none; font-size: 13px; font-weight: 600; padding: 11px 24px; border-radius: 6px; }
              .btn-link { display: inline-block; background: #d97706; color: #ffffff !important; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; margin-right: 8px; }
              .footer { padding: 16px 24px; background: #fafafa; border-top: 1px solid #f4f4f5; font-size: 11px; color: #71717a; text-align: center; line-height: 1.4; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${priorityLabel}</h1>
              </div>
              <div class="content">
                <span class="badge" style="${badgeBg}">${priority.toUpperCase()} PRIORITY</span>
                <h2 class="announcement-title">${trimmedTitle}</h2>
                <div class="sender-bar">
                  Posted by <strong>${senderName}</strong> (Class Representative) • ${currentDateTime}
                </div>
                <div class="message-body">${trimmedMessage}</div>
                ${
                  safeLink
                    ? `<div class="link-box">
                        <strong>Attached Resource:</strong><br/>
                        <a href="${safeLink}" target="_blank" rel="noopener noreferrer">${safeLink}</a>
                       </div>`
                    : ""
                }
                <div class="actions">
                  ${
                    safeLink
                      ? `<a href="${safeLink}" target="_blank" class="btn-link">Open Attached Link</a>`
                      : ""
                  }
                  <a href="${appUrl}" class="btn">View on ClassDesk</a>
                </div>
              </div>
              <div class="footer">
                This announcement was broadcast directly by your Class Representative via ${appName}.<br/>
                Sent to: ${targetAll ? "All Classmates" : `${recipients.length} Selected Students`}
              </div>
            </div>
          </body>
        </html>
      `;

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
              from: `"${appName} • Class Announcement" <${gmailUser}>`,
              to: recipient.email,
              subject: subjectLine,
              html: htmlContent,
            });
            emailsSent++;
          } catch (err) {
            console.error(`Gmail SMTP broadcast error for ${recipient.email}:`, err);
          }
        }
      } else if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const fromEmail =
          process.env.RESEND_FROM_EMAIL || "ClassDesk <onboarding@resend.dev>";

        for (const recipient of recipients) {
          try {
            await resend.emails.send({
              from: fromEmail,
              to: recipient.email,
              subject: subjectLine,
              html: htmlContent,
            });
            emailsSent++;
          } catch (err) {
            console.error(`Resend broadcast error for ${recipient.email}:`, err);
          }
        }
      } else {
        console.info("No email credentials configured. Skipping email send.");
      }
    }

    // 4. Browser Web Push Notification Broadcast
    if (sendPush) {
      try {
        let pushQuery = supabase
          .from("push_subscriptions")
          .select("id, user_id, endpoint, p256dh, auth");

        if (!targetAll && targetUserIdsList.length > 0) {
          pushQuery = pushQuery.in("user_id", targetUserIdsList);
        }

        const { data: subs, error: subsErr } = await pushQuery;

        if (!subsErr && subs && subs.length > 0) {
          const pushPayload = JSON.stringify({
            title: `${
              priority === "urgent"
                ? "🚨 URGENT: "
                : priority === "important"
                ? "⭐ "
                : "📢 "
            }${trimmedTitle}`,
            body:
              trimmedMessage.length > 140
                ? trimmedMessage.slice(0, 137) + "..."
                : trimmedMessage,
            url: link?.trim() || "/",
            tag: `announcement-${Date.now()}`,
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
                await webpush.sendNotification(pushConfig, pushPayload);
                pushSent++;
              } catch (err: unknown) {
                const statusCode = (err as { statusCode?: number })?.statusCode;
                if (statusCode === 404 || statusCode === 410) {
                  expiredSubIds.push(sub.id);
                } else {
                  console.warn("Failed web push to subscriber:", sub.endpoint, err);
                }
              }
            })
          );

          if (expiredSubIds.length > 0) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .in("id", expiredSubIds);
          }
        }
      } catch (err) {
        console.error("Browser push broadcast error:", err);
      }
    }

    // 5. Persist Announcement in Database (with graceful fallback if table not yet migrated)
    let savedAnnouncement = null;
    try {
      const { data, error: dbErr } = await supabase
        .from("announcements")
        .insert({
          title: trimmedTitle,
          message: trimmedMessage,
          priority,
          link: link?.trim() || null,
          sender_id: user.id,
          sender_name: senderName,
          sender_email: senderEmail,
          target_type: targetAll ? "all" : "selected",
          target_user_ids: targetAll ? null : targetUserIdsList,
          target_count: recipients.length,
          channels: [
            ...(sendEmail ? ["mail"] : []),
            ...(sendPush ? ["browser"] : []),
          ],
          emails_sent: emailsSent,
          push_sent: pushSent,
        })
        .select()
        .single();

      if (!dbErr && data) {
        savedAnnouncement = data;
      } else if (dbErr) {
        console.warn("Could not insert announcement to announcements table:", dbErr.message);
      }
    } catch (err) {
      console.warn("Announcements table insert error (run announcements_schema.sql if not created):", err);
    }

    return NextResponse.json({
      success: true,
      emailsSent,
      pushSent,
      targetCount: recipients.length,
      announcement: savedAnnouncement,
    });
  } catch (err: unknown) {
    console.error("Broadcast handler error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

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
        return NextResponse.json(
          { error: "Forbidden: Admins only" },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing announcement id" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
