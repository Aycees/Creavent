import { Injectable, Logger } from '@nestjs/common';
import { appConfig } from '../config.js';

// Asks the web app to refresh the cached public pages under these tags
// (decision Q1). Called after the change is committed. A failed refresh only
// leaves a page stale until its next change, so it is logged, never thrown.
@Injectable()
export class PublicRefreshService {
  private readonly logger = new Logger('PublicRefresh');

  async refresh(list: string[]) {
    const { webUrl, revalidateSecret } = appConfig();
    const unique = [...new Set(list)];
    if (!revalidateSecret || unique.length === 0) return;
    try {
      const res = await fetch(`${webUrl}/internal/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': revalidateSecret },
        body: JSON.stringify({ tags: unique }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) this.logger.warn(`Refresh of ${unique.join(', ')} failed with ${res.status}`);
    } catch (error) {
      this.logger.warn(`Refresh of ${unique.join(', ')} failed: ${(error as Error).message}`);
    }
  }
}
