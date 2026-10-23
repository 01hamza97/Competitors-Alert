import { NextResponse } from 'next/server';
import { getUsers, saveUsers, hashPassword, createSession } from '@/lib/auth';
import { createEntity } from '@/lib/entityStore';

export async function POST(request) {
  try {
    const { full_name, email, password, company_name, role = 'admin' } = await request.json();

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
    }

    const users = getUsers();
    const existing = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const orgName = company_name?.trim() || `${full_name.split(' ')[0]}'s Dealership Group`;
    
    // Create new dealer group for the new SaaS tenant
    const newGroup = await createEntity('DealerGroup', {
      name: orgName,
      slug: orgName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      principal_name: full_name,
      principal_emails: email,
      is_single_store: false,
    });

    const newUser = {
      id: `user_${Date.now()}`,
      email: email.trim().toLowerCase(),
      full_name: full_name.trim(),
      password: hashPassword(password),
      role: role,
      company: orgName,
      plan: 'Pro', // Default new trial plan
      dealer_group_ids: newGroup.id,
      store_ids: '',
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    if (process.env.DATABASE_URL) {
      try {
        const prisma = (await import('@/lib/prisma')).default;
        await prisma.user.create({
          data: {
            id: newUser.id,
            email: newUser.email,
            password: newUser.password,
            fullName: newUser.full_name,
            role: newUser.role,
            company: newUser.company,
            plan: newUser.plan,
            dealerGroupIds: newUser.dealer_group_ids,
            storeIds: newUser.store_ids,
          },
        });
      } catch (e) {
        console.warn('Prisma signup fallback to JSON:', e.message);
      }
    }

    const token = await createSession(newUser.id);
    const { password: _, ...safeUser } = newUser;

    const response = NextResponse.json({ user: safeUser, group: newGroup });
    response.cookies.set('dealerdata_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
