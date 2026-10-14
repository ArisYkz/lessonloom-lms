import { describe, expect, it } from "vitest";
import { authErrorKey } from "@/lib/auth-errors";

const err = (message: string) => new Error(message);

describe("authErrorKey", () => {
  it("maps a wrong password to its own message", () => {
    expect(authErrorKey(err("Invalid login credentials"))).toBe("auth.errCredentials");
  });

  it("maps an unconfirmed address, which is what a fresh signup hits", () => {
    expect(authErrorKey(err("Email not confirmed"))).toBe("auth.errNotConfirmed");
  });

  it("maps signing up with an address that already exists", () => {
    expect(authErrorKey(err("User already registered"))).toBe("auth.errRegistered");
  });

  it("maps both weak-password spellings to one message", () => {
    expect(authErrorKey(err("Password should be at least 6 characters"))).toBe(
      "auth.errWeakPassword",
    );
    expect(authErrorKey(err("Password is known to be weak and easy to guess"))).toBe(
      "auth.errWeakPassword",
    );
  });

  it("falls back to the generic message rather than showing provider English", () => {
    expect(authErrorKey(err("Signups not allowed for this instance"))).toBe("common.error");
    expect(authErrorKey(new Error(""))).toBe("common.error");
    expect(authErrorKey(undefined)).toBe("common.error");
  });
});
