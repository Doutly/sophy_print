import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";

export interface AdminAuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

const LOCAL_ADMIN_KEY = "sophy_admin_session_v1";

/**
 * Sign in or auto-bootstrap the admin account in Firebase Authentication.
 * Never hardcodes validation logic; executes entirely through Firebase Auth service.
 */
export async function authenticateAdmin(email: string, password: string): Promise<User> {
  const cleanEmail = email.trim();

  try {
    // 1. Attempt standard Firebase Auth sign-in
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const user = credential.user;

    // Ensure admin role document is recorded in Firestore
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email,
          role: "admin",
          lastLogin: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {
      // offline fallback
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify({ uid: user.uid, email: user.email }));
    }

    return user;
  } catch (err: any) {
    // 2. If the admin user does not exist in Firebase Auth yet, automatically register in Firebase Auth
    if (
      err.code === "auth/user-not-found" ||
      err.code === "auth/invalid-credential" ||
      err.code === "auth/user-disabled"
    ) {
      try {
        const newCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const newUser = newCredential.user;

        // Save admin role in Firebase Firestore service
        await setDoc(doc(db, "users", newUser.uid), {
          email: newUser.email,
          role: "admin",
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        });

        if (typeof window !== "undefined") {
          localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify({ uid: newUser.uid, email: newUser.email }));
        }

        return newUser;
      } catch (createErr: any) {
        if (createErr.code === "auth/email-already-in-use") {
          throw new Error("Invalid password for this administrator account. Please re-enter your password.");
        }
        throw new Error(createErr.message || "Could not authenticate admin account in Firebase.");
      }
    }

    if (err.code === "auth/wrong-password") {
      throw new Error("Incorrect administrator password.");
    }
    if (err.code === "auth/invalid-email") {
      throw new Error("Invalid email address format.");
    }
    if (err.code === "auth/weak-password") {
      throw new Error("Password must be at least 6 characters.");
    }

    throw new Error(err.message || "Failed to sign in to Firebase.");
  }
}

export async function logoutAdmin(): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.removeItem(LOCAL_ADMIN_KEY);
  }
  await signOut(auth);
}

/**
 * Hook to monitor the active Firebase Admin Authentication state
 */
export function useAdminAuth(): {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage fallback for fast hydration
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LOCAL_ADMIN_KEY);
      if (saved && !user) {
        // will be verified by Firebase onAuthStateChanged below
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser && typeof window !== "undefined") {
        localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify({ uid: currentUser.uid, email: currentUser.email }));
      }
    });

    return () => unsubscribe();
  }, []);

  return {
    user,
    loading,
    logout: logoutAdmin,
  };
}
