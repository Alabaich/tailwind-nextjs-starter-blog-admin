import { NextResponse } from 'next/server';
import { callDeployer } from '@/lib/deployer';
import type { AdminStatus, DeployerStatus } from '@/lib/deployer';
import { contentChangedAt } from '@/lib/posts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { status, body } = await callDeployer('/status', 'GET');
    if (status !== 200) throw new Error(`deployer answered ${status}`);
    const deployer = body as DeployerStatus;
    // The live release was built from a snapshot taken at activeBuiltAt;
    // anything written to disk after that is not on the site yet.
    const changed = contentChangedAt();
    const dirty =
      changed !== null &&
      deployer.activeBuiltAt !== null &&
      changed.getTime() > Date.parse(deployer.activeBuiltAt);
    const payload: AdminStatus = { ...deployer, dirty };
    return NextResponse.json(payload);
  } catch {
    const payload: AdminStatus = { status: 'unreachable' };
    return NextResponse.json(payload, { status: 502 });
  }
}
