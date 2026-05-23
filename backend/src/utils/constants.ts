export const FREE_PLAN_LIMITS = {
  meetingsPerMonth: 5,
  maxRecordingSeconds: 30 * 60, // 30 minutes
  transcriptRetentionDays: 7,
};

export const PRO_PLAN_LIMITS = {
  meetingsPerMonth: Infinity,
  maxRecordingSeconds: Infinity,
  transcriptRetentionDays: Infinity,
};
