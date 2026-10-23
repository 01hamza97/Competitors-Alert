'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Check, ExternalLink, Activity, Mail, AlertTriangle, Sparkles } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(data => {
        if (data.notifications && data.notifications.length > 0) {
          const mapped = data.notifications.map(n => {
            let icon = Activity;
            let color = 'text-emerald-500 bg-emerald-50';
            if (n.category === 'email') {
              icon = Mail;
              color = 'text-blue-500 bg-blue-50';
            } else if (n.category === 'spurt') {
              icon = Sparkles;
              color = 'text-purple-500 bg-purple-50';
            } else if (n.category === 'alert') {
              icon = AlertTriangle;
              color = 'text-amber-500 bg-amber-50';
            }
            return {
              ...n,
              time: 'Recent',
              icon,
              color,
            };
          });
          setNotifications(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await fetch('/api/notifications', { method: 'PATCH' }).catch(() => {});
  };

  const markOneAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
          title="Notifications"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-slate-800">
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0 shadow-xl border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <Check size={12} /> Mark all read
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              No notifications yet.
            </div>
          ) : (
            notifications.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => markOneAsRead(item.id)}
                  className={`p-3.5 flex gap-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                    !item.read ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${item.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs truncate ${!item.read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0">{item.time}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  {!item.read && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 self-center shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-2 border-t border-gray-100 bg-gray-50/50 text-center">
          <Link
            href="/admin/clients"
            className="text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors inline-block py-1"
          >
            View Scraper Logs & Health &rarr;
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
