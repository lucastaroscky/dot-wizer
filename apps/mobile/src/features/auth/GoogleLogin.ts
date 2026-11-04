export type GoogleLoginStatus = "idle" | "open" | "checking";

export type GoogleLogin = { status: GoogleLoginStatus; error: string; signIn: () => void };
