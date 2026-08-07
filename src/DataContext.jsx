import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

const DataContext = createContext(null);

const FALLBACK = {
  employees: [],
  projects: [],
  reviews: [],
  rubric: [],
  rubricsByDocType: [],
  docTypes: [],
  docTypeMeta: [],
  audit: [],
  analytics: { monthly: [], docPerf: [], distribution: [], weakAreas: [], heatmap: [] },
  kpis: null,
  notifications: [],
  me: null,
  view: null,
};

export function DataProvider({ children }) {
  const { authenticated, token } = useAuth();
  const [data, setData] = useState(FALLBACK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [latestReviewId, setLatestReviewId] = useState(null);
  const [ready, setReady] = useState(false);
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setData(FALLBACK);
      setReady(false);
      setLoading(false);
      return null;
    }
    const boot = await api.bootstrap();
    if (!aliveRef.current) return boot;
    setError(null);
    setData({
      employees: boot.employees || [],
      projects: boot.projects || [],
      reviews: boot.reviews || [],
      rubric: boot.rubric || [],
      rubricsByDocType: boot.rubricsByDocType || [],
      docTypes: boot.docTypes || [],
      docTypeMeta: boot.docTypeMeta || [],
      audit: boot.audit || [],
      analytics: boot.analytics || FALLBACK.analytics,
      kpis: boot.kpis || null,
      notifications: boot.notifications || [],
      me: boot.me || null,
      view: boot.view || null,
    });
    setReady(true);
    setLoading(false);
    return boot;
  }, [authenticated]);

  useEffect(() => {
    aliveRef.current = true;
    if (!authenticated) {
      setData(FALLBACK);
      setReady(false);
      setLoading(false);
      setError(null);
      return () => { aliveRef.current = false; };
    }

    let tries = 0;
    let timer = null;
    setLoading(true);
    setReady(false);

    const load = async () => {
      try {
        await refresh();
      } catch (err) {
        if (!aliveRef.current) return;
        tries += 1;
        if (tries < 8) {
          setError(`Loading workspace… (${tries}/8)`);
          timer = setTimeout(load, 700);
        } else {
          setError(err.message || "Failed to load workspace data");
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      aliveRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [authenticated, token, refresh]);

  const value = useMemo(
    () => ({
      ...data,
      loading: authenticated && loading && !ready,
      error: ready ? null : error,
      ready: authenticated && ready,
      refresh,
      latestReviewId,
      setLatestReviewId,
    }),
    [data, loading, error, ready, refresh, latestReviewId, authenticated]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
