import { pool } from '../db/pool';
import { sendEmail } from './email';

export type PaymentNotification = {
    business: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    reference: string;
    details: string;
    payer?: string;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));
const formatAmount = (amount: number) => new Intl.NumberFormat('en-MW', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

function paymentEmail(payment: PaymentNotification) {
    const rows: [string, string][] = [
        ['Business', payment.business],
        ['Amount received', `MWK ${formatAmount(payment.amount)}`],
        ['Payment method', payment.paymentMethod.replace(/_/g, ' ')],
        ['Payment date', payment.paymentDate],
        ...(payment.payer ? [['Paid by', payment.payer] as [string, string]] : []),
        ['Details', payment.details],
        ['Reference', payment.reference],
    ];
    const text = [
        'GOOD MORNING',
        'PAYMENT RECEIVED',
        '',
        'Hello Manager,',
        '',
        'A payment has been successfully recorded in the Good Morning system. The transaction summary is below.',
        '',
        ...rows.map(([label, value]) => `${label}: ${value}`),
        '',
        'This is an automated notification. Please sign in to Good Morning if you need to review the transaction.',
        '',
        'Regards,',
        'Good Morning System',
    ].join('\n');
    const htmlRows = rows.map(([label, value]) => `<tr>
        <th align="left" style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#475569;font-size:13px;font-weight:600;">${escapeHtml(label)}</th>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#0f172a;font-size:14px;">${escapeHtml(value)}</td>
    </tr>`).join('');
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">A payment has been recorded in Good Morning.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0f766e;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:700;">Good Morning</td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 8px;color:#0f766e;font-size:12px;font-weight:700;letter-spacing:1px;">PAYMENT RECEIVED</p>
          <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;">A payment has been recorded</h1>
          <p style="margin:0 0 22px;color:#475569;font-size:15px;line-height:1.6;">Hello Manager, a payment has been successfully recorded in the Good Morning system. Here is the transaction summary.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-collapse:collapse;">${htmlRows}</table>
          <p style="margin:22px 0 0;color:#475569;font-size:14px;line-height:1.6;">Please sign in to Good Morning if you need to review the transaction.</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 28px;color:#64748b;font-size:12px;line-height:1.5;">This is an automated notification. Please do not reply.<br>Good Morning System</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    return { text, html };
}

/** Notify active Good Morning super managers after a payment has committed. */
export async function notifyOwnerOfPayment(payment: PaymentNotification): Promise<void> {
    try {
        const managers = await pool.query<{ email: string }>(
            "SELECT email FROM users WHERE active=true AND role='SUPER_MANAGER' ORDER BY created_at, id"
        );
        if (!managers.rowCount) {
            console.warn('Payment notification was not sent: no active SUPER_MANAGER account is configured.');
            return;
        }

        const message = paymentEmail(payment);

        const results = await Promise.allSettled(managers.rows.map(manager => sendEmail({
            to: manager.email,
            subject: `Payment received · ${payment.business} · MWK ${formatAmount(payment.amount)}`,
            ...message,
        })));
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Could not send payment notification to SUPER_MANAGER account ${index + 1}:`, result.reason);
            }
        });
    }
    catch (error) {
        // A notification failure must not undo or misreport a payment already committed.
        console.error('Could not prepare payment notification:', error);
    }
}
