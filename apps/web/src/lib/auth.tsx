"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { AuthUserDto, MeResponse } from "@/lib/types";

type AuthState = {
  user: AuthUserDto | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUserDto>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

const ME_QUERY_KEY = ["auth", "me"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      try {
        return await api.get<MeResponse>("/v1/auth/me");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      api.post<MeResponse>("/v1/auth/login", vars),
    onSuccess: (res) => {
      qc.setQueryData(ME_QUERY_KEY, res);
    },
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await loginMutation.mutateAsync({ email, password });
      return res.user;
    },
    [loginMutation],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/v1/auth/logout");
    } catch {
      /* ignore */
    }
    qc.setQueryData(ME_QUERY_KEY, null);
    qc.clear();
    router.push("/login");
  }, [qc, router]);

  const value = useMemo<AuthState>(() => {
    const user = data?.user ?? null;
    const perms = new Set(user?.permissions ?? []);
    return {
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      logout,
      hasPermission: (key: string) => perms.has(key),
    };
  }, [data, isLoading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
