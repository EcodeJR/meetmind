type EmailSection = {
  title?: string;
  body?: string;
  bullets?: string[];
  rawHtml?: string;
};

type EmailTemplateOptions = {
  preheader?: string;
  title: string;
  greetingName?: string;
  intro?: string;
  sections?: EmailSection[];
  footer?: string;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildList = (items: string[]): string => {
  if (!items.length) return '';
  return `
    <ul style="margin: 14px 0 0 18px; padding: 0; color: #374151; font-size: 14px; line-height: 1.7;">
      ${items.map(item => `<li style="margin: 0 0 8px 0;">${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
};

export const buildEmailTemplate = (options: EmailTemplateOptions): string => {
  const greeting = options.greetingName ? `Hello <strong>${escapeHtml(options.greetingName)}</strong>,` : 'Hello,';
  const sections = (options.sections || [])
    .map(section => {
      if (section.rawHtml) {
        return `
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 18px 18px 8px; margin: 16px 0;">
            ${section.rawHtml}
          </div>
        `;
      }

      return `
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 18px; margin: 16px 0;">
          ${section.title ? `<p style="margin: 0 0 10px 0; color: #111827; font-size: 15px; font-weight: 700;">${escapeHtml(section.title)}</p>` : ''}
          ${section.body ? `<p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.7;">${escapeHtml(section.body)}</p>` : ''}
          ${section.bullets ? buildList(section.bullets) : ''}
        </div>
      `;
    })
    .join('');

  return `
    <div style="margin: 0; padding: 0; background: #f3f4f6; width: 100%;">
      <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${escapeHtml(options.preheader || options.title)}</div>
      <div style="max-width: 640px; margin: 0 auto; padding: 24px 16px 40px; font-family: Arial, Helvetica, sans-serif; color: #111827;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #334155 100%); border-radius: 22px 22px 0 0; padding: 28px 28px 22px; color: #ffffff;">
          <div style="font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.8;">Memovoice</div>
          <h1 style="margin: 10px 0 0 0; font-size: 26px; line-height: 1.2;">${escapeHtml(options.title)}</h1>
        </div>
        <div style="background: #ffffff; border-radius: 0 0 22px 22px; padding: 28px; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);">
          <p style="margin: 0 0 16px 0; color: #111827; font-size: 15px; line-height: 1.7;">${greeting}</p>
          ${options.intro ? `<p style="margin: 0 0 12px 0; color: #4b5563; font-size: 14px; line-height: 1.8;">${escapeHtml(options.intro)}</p>` : ''}
          ${sections}
          <div style="margin-top: 22px; padding-top: 18px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; line-height: 1.7;">
            ${options.footer ? escapeHtml(options.footer) : 'Memovoice Team · Institutional trust. Professional depth.'}
          </div>
        </div>
      </div>
    </div>
  `;
};

export type { EmailSection, EmailTemplateOptions };
