// Front-end mock auth — backed by mockStore (localStorage).
import { useMockStore } from "@/lib/mock-store";

export type AuthState = {
  user: { id: string; email: string } | null;
  email: string | null;
  isAdmin: boolean;
  loading: boolean;
  session: { user: { id: string; email: string } } | null;
};

export function useAuth(): AuthState {
  const user = useMockStore((s) => s.user);
  return {
    user: user ? { id: user.id, email: user.email } : null,
    email: user?.email ?? null,
    isAdmin: !!user?.isAdmin,
    loading: false,
    session: user ? { user: { id: user.id, email: user.email } } : null,
  };
}
