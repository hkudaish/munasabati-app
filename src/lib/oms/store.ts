// Database-backed OMS settings. Operational data never falls back to samples.
import 'server-only';
import prisma from '../db';
import type { OMSSettings } from './types';
import { DEFAULT_ROUTING_WEIGHTS } from './routing-engine';
import { HttpError } from '../server/http';
const DEFAULT_SETTINGS: OMSSettings = {
  id: 'default',
  acceptanceDeadlineMinutes: 120,
  executionNoticeDays: 2,
  customerReviewDeadlineHours: 48,
  alert50PercentEnabled: true,
  alert75PercentEnabled: true,
  alert90PercentEnabled: true,
  alert100PercentEnabled: true,
  autoReassignOnTimeout: true,
  maxInactivityHours: 24,
  routingWeights: DEFAULT_ROUTING_WEIGHTS,
  escalationPolicy: {
    l1TimeoutMinutes: 30,
    l2TimeoutMinutes: 60,
    l3TimeoutMinutes: 120,
    l4TimeoutMinutes: 240,
  },
  businessHoursConfig: {
    startHour: 9,
    endHour: 23,
    workDays: [0, 1, 2, 3, 4, 5, 6],
  },
  deliveryProofRequired: true,
  autoClosePeriodDays: 3,
  maxRetryAttempts: 3,
  updatedAt: new Date().toISOString(),
};

export async function getOMSSettings(): Promise<OMSSettings> {
  const config = await prisma.oMSAutomationConfig.findUnique({ where: { id: 'default' } });
  if (!config) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...config, routingWeights: config.routingWeights as any || DEFAULT_ROUTING_WEIGHTS,
    escalationPolicy: config.escalationPolicy as any || DEFAULT_SETTINGS.escalationPolicy,
    businessHoursConfig: config.businessHoursConfig as any || DEFAULT_SETTINGS.businessHoursConfig,
    updatedBy: config.updatedBy || undefined, updatedAt: config.updatedAt.toISOString() };
}
export async function saveOMSSettings(settings: OMSSettings, actorUserId: string): Promise<OMSSettings> {
  const numeric = ['acceptanceDeadlineMinutes','executionNoticeDays','customerReviewDeadlineHours','maxInactivityHours','autoClosePeriodDays','maxRetryAttempts'] as const;
  const boolean = ['alert50PercentEnabled','alert75PercentEnabled','alert90PercentEnabled','alert100PercentEnabled','autoReassignOnTimeout','deliveryProofRequired'] as const;
  const data: any = { updatedBy: actorUserId };
  for (const key of numeric) {
    if (!Number.isInteger(settings[key]) || settings[key] < 1 || settings[key] > 10080) throw new HttpError(400, 'إعداد رقمي غير صالح');
    data[key] = settings[key];
  }
  for (const key of boolean) { if (typeof settings[key] !== 'boolean') throw new HttpError(400, 'إعداد غير صالح'); data[key] = settings[key]; }
  for (const key of ['routingWeights','escalationPolicy','businessHoursConfig'] as const) {
    if (settings[key] !== undefined) {
      if (!settings[key] || typeof settings[key] !== 'object' || Array.isArray(settings[key]) || JSON.stringify(settings[key]).length > 5000) throw new HttpError(400, 'إعداد غير صالح');
      data[key] = settings[key];
    }
  }
  await prisma.$transaction(async tx => {
    await tx.oMSAutomationConfig.upsert({ where: { id: 'default' }, create: { id: 'default', ...data }, update: data });
    await tx.systemAuditLog.create({ data: { actorId: actorUserId, action: 'OMS_SETTINGS_UPDATED', targetId: 'default', details: data } });
  });
  return getOMSSettings();
}
