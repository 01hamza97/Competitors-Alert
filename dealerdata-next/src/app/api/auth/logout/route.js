import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export async function POST(request) {
  try {
    const token = request.cookies.get('dealerdata_session')?.value;
    if (token) {
      await destroySession(token);
    }
    const response = NextResponse.json({ success: true });
    response.cookies.delete('dealerdata_session');
    return response;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
