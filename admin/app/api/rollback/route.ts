import { NextResponse } from 'next/server';
import { callDeployer } from '@/lib/deployer';
import { jsonError } from '@/lib/http';

export async function POST() {
  try {
    const { status, body } = await callDeployer('/rollback', 'POST');
    return NextResponse.json(body, { status });
  } catch {
    return jsonError('Deployer is unreachable', 502);
  }
}
