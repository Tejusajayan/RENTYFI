import { useAuth } from "@/hooks/useAuth";

export function requireAuth() {
  const { user } = useAuth();
  
  if (!user) {
    throw new Error("Authentication required");
  }
  
  return user;
}

export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}
