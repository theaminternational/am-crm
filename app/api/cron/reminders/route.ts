import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { Resend } from 'resend';

// Force the route to run dynamically on every request
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const adminDb = getAdminDb();
    
    // 1. Set up Resend (using the API key from .env.local)
    const resend = new Resend(process.env.RESEND_API_KEY);

    // 2. Fetch all users so we know what email addresses to send to
    const usersSnap = await adminDb.collection('users').get();
    const userEmails: Record<string, string> = {};
    const adminAndLeadEmails = new Set<string>();

    usersSnap.forEach(u => {
      const data = u.data();
      if (data.email) {
        userEmails[u.id] = data.email;
        if (data.role === 'admin' || data.role === 'lead') {
          adminAndLeadEmails.add(data.email);
        }
      }
    });

    // 3. Fetch all tasks and filter in memory to catch legacy tasks
    const tasksSnap = await adminDb.collection('tasks').get();
    
    console.log(`CRON FETCHED ${tasksSnap.docs.length} TOTAL TASKS FROM DB.`);
    
    const now = new Date();
    let emailsSent = 0;

    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data();
      const taskId = taskDoc.id;

      console.log(`CRON TASK SEEN: ${task.title} | done: ${task.done} | status: ${task.status} | dueDate: ${task.dueDate} | time: ${task.time}`);

      if (task.done === true || task.status === 'completed') continue;
      if (!task.dueDate) continue; // Skip tasks without a due date

      // Combine dueDate and time into an exact timestamp
      let dueDateTimeString = task.dueDate;
      if (task.time) {
        dueDateTimeString = `${task.dueDate}T${task.time}`;
      } else {
        // If no time is specified, assume end of the day
        dueDateTimeString = `${task.dueDate}T23:59:59`;
      }

      const dueTime = new Date(dueDateTimeString).getTime();
      if (isNaN(dueTime)) continue; // Skip if invalid date format

      const diffMs = dueTime - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      console.log(`Task: ${task.title} | Due: ${dueDateTimeString} | DiffHours: ${diffHours} | Assigned: ${task.assignedTo}`);

      // Only send reminders for tasks that are in the future
      if (diffHours < 0) continue;

      const reminders = task.remindersSent || {};
      let needsEmailFor = null;

      // Determine which threshold we have crossed (prioritize the tightest window)
      // Example: If diffHours is 0.5, we should send the 1h reminder (if not sent)
      // If diffHours is 4, we send the 6h reminder.
      if (diffHours <= 1 && !reminders['1h']) {
        needsEmailFor = '1h';
      } else if (diffHours <= 6 && !reminders['6h']) {
        needsEmailFor = '6h';
      } else if (diffHours <= 24 && !reminders['24h']) {
        needsEmailFor = '24h';
      }

      if (needsEmailFor) {
        const recipients = new Set<string>(adminAndLeadEmails);
        
        const assigneeEmail = userEmails[task.assignedTo];
        if (assigneeEmail) {
          recipients.add(assigneeEmail);
        }

        const toAddresses = Array.from(recipients);
        
        if (toAddresses.length > 0) {
          // 4. Send the Email
          await resend.emails.send({
            from: 'A&M CRM <crm@theaminternational.com>',
            to: toAddresses,
            subject: `Action Required: Task "${task.title}" is due in ${needsEmailFor.replace('h', ' hours')}`,
            html: `
              <div style="background:#f8f9fc;padding:40px 20px;font-family:Arial,sans-serif;">
                <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                  <div style="background:var(--navy);padding:32px;text-align:center;">
                    <h1 style="color:#C9A84C;margin:0;font-size:24px;letter-spacing:1px;">A&M CRM</h1>
                    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px;">Task Reminder</p>
                  </div>
                  <div style="padding:32px;">
                    <p style="color:#1a1a2e;font-size:16px;margin-bottom:12px;">Hi <strong>${task.assignedToName || 'Team'}</strong>,</p>
                    <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">This is an automated system reminder that your assigned task is due in <strong>${needsEmailFor.replace('h', ' hours')}</strong>.</p>
  
                    <div style="background:#f8f9fc;border-left:4px solid #C9A84C;padding:24px;border-radius:0 8px 8px 0;">
                      <h3 style="color:#0D1B3E;margin:0 0 8px;font-size:18px;">${task.title}</h3>
                      <p style="color:#4b5563;font-size:13px;margin:4px 0;"><strong>Deadline:</strong> ${new Date(dueTime).toLocaleString()}</p>
                      ${task.clientName ? `<p style="color:#4b5563;font-size:13px;margin:4px 0;"><strong>Client:</strong> ${task.clientName}</p>` : ""}
                      ${task.description ? `<p style="color:#4b5563;font-size:13px;margin:12px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;"><strong>Notes:</strong> ${task.description}</p>` : ""}
                    </div>
                    
                    <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:40px;">The A&M Internationals FZC · Elevating the World, Elegantly</p>
                  </div>
                </div>
              </div>
            `
          });
          emailsSent++;
        }

        // CREATE IN-APP NOTIFICATIONS
        const notificationPromises = [];
        
        // Notify Assignee
        if (task.assignedTo) {
          notificationPromises.push(adminDb.collection('notifications').add({
            userId: task.assignedTo,
            title: "Deadline Approaching",
            message: `Task "${task.title}" is due in ${needsEmailFor.replace('h', ' hours')}`,
            link: `/tasks/${taskId}?tab=blueprints`,
            read: false,
            createdAt: now.toISOString(),
            type: "system"
          }));
        }

        // Notify Admins/Leads
        for (const uDoc of usersSnap.docs) {
          const d = uDoc.data();
          if (d.role === 'admin' || d.role === 'lead') {
            if (uDoc.id !== task.assignedTo) {
               notificationPromises.push(adminDb.collection('notifications').add({
                  userId: uDoc.id,
                  title: "Team Deadline",
                  message: `Task "${task.title}" is due in ${needsEmailFor.replace('h', ' hours')}`,
                  link: `/tasks/${taskId}?tab=blueprints`,
                  read: false,
                  createdAt: now.toISOString(),
                  type: "system"
               }));
            }
          }
        }
        await Promise.all(notificationPromises);

        // 5. Update the task document so we never send this specific reminder interval again
        await adminDb.collection('tasks').doc(taskId).update({
          [`remindersSent.${needsEmailFor}`]: true
        });
      }
    }

    // 6. Database Cleanup: Delete old read notifications (older than 7 days) to prevent bloat
    try {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const oldNotifsSnap = await adminDb.collection('notifications')
        .where('read', '==', true)
        .where('createdAt', '<', sevenDaysAgo)
        .get();
        
      const batch = adminDb.batch();
      let deletedCount = 0;
      oldNotifsSnap.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      
      if (deletedCount > 0) {
        await batch.commit();
        console.log(`CRON: Cleaned up ${deletedCount} old notifications.`);
      }
    } catch (cleanupError) {
      console.error("CRON Cleanup Error:", cleanupError);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cron job executed successfully. Sent ${emailsSent} reminder emails.` 
    });

  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
