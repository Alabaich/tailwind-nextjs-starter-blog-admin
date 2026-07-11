import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${process.env.DEPLOYER_URL}/status`, {
      headers: { authorization: `Bearer ${process.env.DEPLOY_TOKEN}` },
      cache: 'no-store',
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ status: 'unreachable' }, { status: 502 });
  }
}
