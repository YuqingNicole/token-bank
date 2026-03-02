import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ track: string }>
}

export async function POST(
  req: NextRequest,
  context: RouteContext
) {
  const { track } = await context.params;
  const subKey = req.headers.get('x-api-key');
  
  const MASTER_KEY = process.env.CLAUDE_MASTER_KEY;

  if (!subKey || !subKey.includes(track)) {
    return NextResponse.json({ error: 'Unauthorized Track' }, { status: 401 });
  }

  try {
    const bodyText = await req.text();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': MASTER_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: bodyText
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Upstream Error' }, { status: 500 });
  }
}
