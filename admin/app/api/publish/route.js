import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const res = await fetch(`${process.env.DEPLOYER_URL}/rebuild`, {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.DEPLOY_TOKEN}` },
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Deployer is unreachable' }, { status: 502 });
  }
}
