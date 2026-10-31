import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Me } from "./api";

interface Auth {
  /** undefined while loading. */
  user: Me | null | undefined;
  setUser: (u: Me | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<Auth>({ user: undefined, setUser: () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    api.me().then(setUser, () => setUser(null));
  }, []);
  const signOut = useCallback(async () => {
    await api.signOut();
    setUser(null);
  }, []);
  return <AuthContext.Provider value={{ user, setUser, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
