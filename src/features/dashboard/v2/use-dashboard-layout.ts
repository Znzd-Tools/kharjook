'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuth } from '@/features/portfolio/PortfolioProvider';
import { DEFAULT_LAYOUT, normalizeLayout, type DashboardLayout } from './blocks';

const LOCAL_KEY = 'kj_dashboard_layout';

/**
 * Dashboard block order / visibility. Saved in `user_preferences`
 * (synced across devices); falls back to this device if the table is not
 * deployed yet.
 */
export function useDashboardLayout() {
  const { user } = useAuth();
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void supabase
      .from('user_preferences')
      .select('dashboard_layout')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setLayout(normalizeLayout(data.dashboard_layout));
          return;
        }
        try {
          const local = window.localStorage.getItem(LOCAL_KEY);
          if (local) setLayout(normalizeLayout(JSON.parse(local)));
        } catch {
          // keep default
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const save = useCallback(
    (next: DashboardLayout) => {
      setLayout(next);
      try {
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      } catch {
        // storage blocked
      }
      if (user) {
        void supabase
          .from('user_preferences')
          .upsert({ user_id: user.id, dashboard_layout: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
          // Supabase queries are lazy: they only run when awaited / then-ed.
          .then(({ error }) => {
            if (error) console.warn('dashboard layout not synced (saved on this device)', error.message);
          });
      }
    },
    [user]
  );

  return { layout, save };
}
