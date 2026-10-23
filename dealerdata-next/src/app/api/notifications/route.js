import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    if (process.env.DATABASE_URL) {
      const items = await prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      return NextResponse.json({
        notifications: items.map(n => ({
          id: n.id,
          title: n.title,
          description: n.description,
          category: n.category,
          read: n.read,
          link: n.link || '/admin/clients',
          created_at: n.createdAt,
        })),
      });
    }
    return NextResponse.json({ notifications: [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id } = await request.json().catch(() => ({}));
    if (process.env.DATABASE_URL) {
      if (id) {
        await prisma.notification.update({
          where: { id },
          data: { read: true },
        });
      } else {
        await prisma.notification.updateMany({
          data: { read: true },
        });
      }
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
