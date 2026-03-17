/**
 * Webhook notification module.
 *
 * Set env var WEBHOOK_URL to a generic webhook endpoint (JSON POST)
 * or FEISHU_WEBHOOK_URL for Feishu/Lark bot webhook.
 * Both are optional — if unset, notifications are silently skipped.
 */

type NotifyPayload = {
  event: string;
  subKey: string;
  vendor: string;
  group: string;
  name: string;
  detail?: string;
  timestamp: string;
};

async function postJSON(url: string, body: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn('[webhook] send failed', url, err);
  }
}

function buildFeishuBody(p: NotifyPayload) {
  const title = p.event === 'quota.exceeded' ? 'Quota Exceeded' : 'Key Expired';
  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: `⚠️ Token Bank: ${title}` },
        template: p.event === 'quota.exceeded' ? 'orange' : 'red',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: [
              `**Event:** ${p.event}`,
              `**Key:** ...${p.subKey}`,
              `**Vendor:** ${p.vendor}`,
              `**Group:** ${p.group}`,
              `**Name:** ${p.name}`,
              p.detail ? `**Detail:** ${p.detail}` : '',
              `**Time:** ${p.timestamp}`,
            ].filter(Boolean).join('\n'),
          },
        },
      ],
    },
  };
}

function buildGenericBody(p: NotifyPayload) {
  return {
    text: `[Token Bank] ${p.event}: key=...${p.subKey} vendor=${p.vendor} group=${p.group} name=${p.name}${p.detail ? ` (${p.detail})` : ''} at ${p.timestamp}`,
    ...p,
  };
}

export function notify(payload: NotifyPayload): void {
  const feishuUrl = process.env.FEISHU_WEBHOOK_URL;
  const genericUrl = process.env.WEBHOOK_URL;

  if (!feishuUrl && !genericUrl) return;

  if (feishuUrl) void postJSON(feishuUrl, buildFeishuBody(payload));
  if (genericUrl) void postJSON(genericUrl, buildGenericBody(payload));
}
