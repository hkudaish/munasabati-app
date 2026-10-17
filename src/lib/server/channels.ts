import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { HttpError, text } from './http';
export const CHANNELS = ['whatsapp', 'sms', 'email'] as const;
export type Channel = typeof CHANNELS[number];
function key() {
  const value = process.env.CHANNEL_ENCRYPTION_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new HttpError(503, 'مفتاح تشفير إعدادات القنوات غير مهيأ على الخادم');
  return Buffer.from(value, 'hex');
}
export function encrypt(secret: string, context: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(), iv); cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('hex'), cipher.getAuthTag().toString('hex'), data.toString('hex')].join(':');
}
export function decrypt(secret: string, context: string) {
  const [version, iv, tag, data] = secret.split(':'); if (version !== 'v1') throw new HttpError(503, 'تعذر قراءة إعدادات القناة');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'hex')); decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
}
export function validateConfig(channel: Channel, input: any): Record<string, string> {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'الإعدادات مطلوبة');
  const fields = channel === 'whatsapp' ? ['phoneNumberId','apiVersion','templateName','language'] : channel === 'sms' ? ['accountSid','from'] : ['from'];
  const config = Object.fromEntries(fields.map(k => [k, text(input[k], 254, true)]));
  if (channel === 'whatsapp' && (!/^\d+$/.test(config.phoneNumberId) || !/^v\d+\.0$/.test(config.apiVersion) || !/^[a-z0-9_]+$/.test(config.templateName) || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(config.language))) throw new HttpError(400, 'إعدادات قالب واتساب غير صالحة');
  if (channel === 'sms' && (!/^AC[a-fA-F0-9]{32}$/.test(config.accountSid) || !/^(\+[1-9]\d{7,14}|[A-Za-z][A-Za-z0-9 ]{0,10})$/.test(config.from))) throw new HttpError(400, 'معرف حساب Twilio أو المرسل غير صالح');
  if (channel === 'email' && (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(config.from) || /[\r\n]/.test(config.from))) throw new HttpError(400, 'بريد المرسل غير صالح');
  return config;
}
export function internationalPhone(phone: string) {
  let digits = phone.replace(/\D/g, ''); if (/^05\d{8}$/.test(digits)) digits = '966' + digits.slice(1); if (digits.startsWith('00')) digits = digits.slice(2);
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new HttpError(400, 'رقم المستلم غير صالح'); return '+' + digits;
}
export async function deliver(channel: Channel, config: Record<string, string>, secret: string, message: { phone: string; email?: string | null; name: string; title: string; url: string; requestKey: string }) {
  const phone = internationalPhone(message.phone); const content = `نتشرف بدعوتكم يا ${message.name} لحضور ${message.title}\n${message.url}`;
  let url: string, init: RequestInit;
  if (channel === 'whatsapp') {
    url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
    init = { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: phone.slice(1), type: 'template', template: { name: config.templateName, language: { code: config.language }, components: [{ type: 'body', parameters: [message.name, message.title, message.url].map(value => ({ type: 'text', text: value })) }] } }) };
  } else if (channel === 'sms') {
    url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
    init = { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${config.accountSid}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: phone, From: config.from, Body: content }).toString() };
  } else {
    if (!message.email) throw new HttpError(400, 'أضف البريد الإلكتروني للضيف أولاً');
    url = 'https://api.resend.com/emails';
    init = { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', 'Idempotency-Key': message.requestKey }, body: JSON.stringify({ from: config.from, to: [message.email], subject: `دعوة: ${message.title}`, text: content }) };
  }
  let response: Response;
  try { response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000), redirect: 'error' }); }
  catch { throw new HttpError(504, 'حالة الإرسال غير معروفة؛ تحقق من لوحة المزود قبل إعادة المحاولة'); }
  if (response.status >= 500) throw new HttpError(504, 'حالة المزود غير مؤكدة؛ راجع لوحة المزود قبل إعادة المحاولة');
  if (!response.ok) throw new HttpError(502, `رفض مزود القناة الطلب (${response.status})`);
  const payload = await response.json();
  const id = channel === 'whatsapp' ? payload.messages?.[0]?.id : channel === 'sms' ? payload.sid : payload.id;
  if (typeof id !== 'string') throw new HttpError(504, 'تعذر تحديد حالة قبول الرسالة؛ راجع لوحة المزود');
  return id;
}
