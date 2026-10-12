'use client';

import { Analytics } from '@vercel/analytics/next';
import { filterAnalyticsEvent } from '../../lib/analytics-events';

export default function SiteAnalytics() {
  return <Analytics beforeSend={filterAnalyticsEvent} />;
}
