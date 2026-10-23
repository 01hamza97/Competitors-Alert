import { NextResponse } from 'next/server';
import { getSessionUser, getUsers } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = request.cookies.get('dealerdata_session')?.value;
    let user = await getSessionUser(token);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(user);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
