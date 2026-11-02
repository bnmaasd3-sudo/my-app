/** Cookie that identifies this browser for the two-device limit. */
export const DEVICE_COOKIE = "qari_device";

export const deviceCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 400,
};
