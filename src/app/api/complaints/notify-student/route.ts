import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify caller is an Admin / CR
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { complaintId, status, replyText } = body;

    if (!complaintId || !status) {
      return NextResponse.json(
        { error: "Missing required fields (complaintId, status)" },
        { status: 400 }
      );
    }

    const appName = process.env.NEXT_PUBLIC_APP_NAME || "ClassDesk";
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://class-chi-topaz.vercel.app";

    // 3. Retrieve student email & complaint info securely
    let studentEmail = "";
    let studentName = "Student";
    let complaintTitle = "Complaint";
    let complaintCategory = "General";

    // Attempt 1: Call SECURITY DEFINER RPC
    const { data: rpcRows, error: rpcErr } = await supabase.rpc(
      "get_complaint_notification_info",
      { p_complaint_id: complaintId }
    );

    if (!rpcErr && rpcRows && rpcRows.length > 0) {
      studentEmail = rpcRows[0].student_email?.trim().toLowerCase() || "";
      studentName = rpcRows[0].student_name || "Student";
      complaintTitle = rpcRows[0].complaint_title || complaintTitle;
      complaintCategory = rpcRows[0].category || complaintCategory;
    } else {
      // Fallback: Query complaints and profiles tables directly
      const { data: cRow } = await supabase
        .from("complaints")
        .select("title, category, student_id, display_name")
        .eq("id", complaintId)
        .single();

      if (cRow) {
        complaintTitle = cRow.title;
        complaintCategory = cRow.category;
        studentName = cRow.display_name?.trim() || "Student";

        if (cRow.student_id) {
          const { data: pRow } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", cRow.student_id)
            .single();

          if (pRow) {
            studentEmail = pRow.email?.trim().toLowerCase() || "";
            if (!cRow.display_name && pRow.full_name) {
              studentName = pRow.full_name;
            }
          }
        }
      }
    }

    if (!studentEmail || !studentEmail.includes("@")) {
      return NextResponse.json({
        success: false,
        message: "No valid student email associated with this complaint.",
      });
    }

    // 4. Configure email styling based on status
    let statusBadgeBg = "#f4f4f5";
    let statusBadgeColor = "#27272a";
    let statusBadgeBorder = "#e4e4e7";
    let statusHeading = `Status Update: ${status}`;

    if (status === "Fixed") {
      statusBadgeBg = "#ecfdf5";
      statusBadgeColor = "#065f46";
      statusBadgeBorder = "#a7f3d0";
      statusHeading = "Resolved / Fixed";
    } else if (status === "In Progress") {
      statusBadgeBg = "#fffbeb";
      statusBadgeColor = "#92400e";
      statusBadgeBorder = "#fde68a";
      statusHeading = "In Progress";
    } else if (status === "Cannot Be Fixed") {
      statusBadgeBg = "#fef2f2";
      statusBadgeColor = "#991b1b";
      statusBadgeBorder = "#fecaca";
      statusHeading = "Cannot Be Fixed";
    }

    const emailSubject = `[${appName}] Update on your complaint: "${complaintTitle}"`;

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
            .content { padding: 24px; }
            .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 4px; background: ${statusBadgeBg}; color: ${statusBadgeColor}; border: 1px solid ${statusBadgeBorder}; margin-bottom: 12px; }
            .title { font-size: 17px; font-weight: 700; color: #09090b; margin: 0 0 10px 0; }
            .meta { font-size: 13px; color: #52525b; margin: 6px 0; }
            .reply-box { background: #f8fafc; border-left: 3px solid #3b82f6; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #1e293b; line-height: 1.5; white-space: pre-wrap; }
            .reply-label { font-weight: 600; color: #0f172a; margin-bottom: 6px; }
            .btn { display: inline-block; background: #18181b; color: #ffffff !important; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; margin-top: 16px; }
            .footer { padding: 16px 24px; background: #fafafa; border-top: 1px solid #f4f4f5; font-size: 11px; color: #71717a; text-align: center; }
            .confidential-note { font-size: 11px; color: #a1a1aa; margin-top: 16px; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${appName} • Complaint Update</h1>
            </div>
            <div class="content">
              <span class="badge">${statusHeading}</span>
              <h2 class="title">${complaintTitle}</h2>
              <div class="meta"><strong>Category:</strong> ${complaintCategory}</div>
              <div class="meta"><strong>Current Status:</strong> ${status}</div>
              
              ${
                replyText
                  ? `
                <div class="reply-box">
                  <div class="reply-label">Message from Class Representative / Admin:</div>
                  ${replyText}
                </div>
              `
                  : ""
              }

              <div style="text-align: center;">
                <a href="${appUrl}/complaints" class="btn">View in Complaints Desk</a>
              </div>

              <div class="confidential-note">
                🔒 Note: Even if you submitted this complaint anonymously, your identity remains completely confidential and hidden from classmates. This email was delivered to you securely.
              </div>
            </div>
            <div class="footer">
              This is an automated notification from ${appName}.
            </div>
          </div>
        </body>
      </html>
    `;

    // 5. Send Email via Gmail SMTP or Resend
    const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
    const resendApiKey = process.env.RESEND_API_KEY;

    let emailSent = false;

    if (gmailUser && gmailPass) {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: gmailUser.trim(),
            pass: gmailPass.replace(/\s+/g, ""),
          },
        });

        await transporter.sendMail({
          from: `"${appName}" <${gmailUser}>`,
          to: studentEmail,
          subject: emailSubject,
          html: htmlContent,
        });
        emailSent = true;
      } catch (err) {
        console.error("Gmail SMTP send failed:", err);
      }
    } else if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const fromEmail =
          process.env.RESEND_FROM_EMAIL || "ClassDesk <onboarding@resend.dev>";

        await resend.emails.send({
          from: fromEmail,
          to: studentEmail,
          subject: emailSubject,
          html: htmlContent,
        });
        emailSent = true;
      } catch (err) {
        console.error("Resend send failed:", err);
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      recipient: studentEmail,
    });
  } catch (err: unknown) {
    console.error("Notify student error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
