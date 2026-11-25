import { deployToken } from './env';

export type Color = 'blog-blue' | 'blog-green';

/** Shape of the deployer's GET /status response. */
export interface DeployerStatus {
  status: 'idle' | 'building' | 'rolling-back' | 'error';
  active: Color;
  pending: boolean;
  error: string | null;
  lastDeployAt: string | null;
  activeBuiltAt: string | null;
  rollbackTo: Color | null;
  log: string[];
}

/** What the admin UI polls: deployer state plus "is there unpublished content". */
export type AdminStatus =
  | (DeployerStatus & { dirty: boolean })
  | { status: 'unreachable' };

export interface DeployerReply {
  status: number;
  body: unknown;
}

export async function callDeployer(path: string, method: 'GET' | 'POST'): Promise<DeployerReply> {
  const res = await fetch(`${process.env.DEPLOYER_URL}${path}`, {
    method,
    headers: { authorization: `Bearer ${deployToken()}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  return { status: res.status, body: await res.json() };
}
