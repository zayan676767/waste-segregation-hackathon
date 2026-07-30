import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { getSocket } from './socket.js';

/**
 * Loads the categories, settings and keyword mappings that drive the entire UI,
 * and keeps them fresh over Socket.IO.
 *
 * This hook is what makes the "nothing hardcoded" rule work: no category name,
 * colour, tip, impact line or threshold exists in the frontend source. Edit one
 * in the admin panel and the change arrives here, on every connected device,
 * without a reload.
 */
export function useAppData() {
  const [data, setData] = useState({
    categories: [],
    settings: {},
    mappings: [],
    status: 'loading',
    error: null
  });

  const load = useCallback(async () => {
    try {
      const [categories, settings, mappings] = await Promise.all([
        api.getCategories(),
        api.getSettings(),
        api.getLabelMap()
      ]);
      setData({
        categories,
        settings: settings.values,
        mappings,
        status: 'ready',
        error: null
      });
    } catch (err) {
      setData((prev) => ({ ...prev, status: 'error', error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();

    const socket = getSocket();
    const reload = () => load();

    socket.on('categories:changed', reload);
    socket.on('labelmap:changed', reload);
    // Settings arrive as a payload, so apply them directly instead of refetching.
    const onSettings = (values) => setData((prev) => ({ ...prev, settings: values }));
    socket.on('settings:changed', onSettings);

    return () => {
      socket.off('categories:changed', reload);
      socket.off('labelmap:changed', reload);
      socket.off('settings:changed', onSettings);
    };
  }, [load]);

  const categoriesById = Object.fromEntries(data.categories.map((c) => [c.id, c]));

  return { ...data, categoriesById, reload: load };
}

/** Reads a setting with a fallback, so a missing key never breaks the UI. */
export function setting(settings, key, fallback) {
  const value = settings?.[key];
  return value === undefined || value === null ? fallback : value;
}
