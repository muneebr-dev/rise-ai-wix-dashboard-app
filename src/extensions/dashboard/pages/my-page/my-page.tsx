import React, { useState, useEffect, type FC } from "react";
import {
  WixDesignSystemProvider,
  Page,
  Box,
  Card,
  Input,
  FormField,
  Button,
  Text,
  Divider,
  EmptyState,
  ListItemSelect,
} from "@wix/design-system";
import * as Icons from "@wix/wix-ui-icons-common";
import "@wix/design-system/styles.global.css";

// --- Types ---
interface Workspace {
  id: string;
  business_name: string;
}

interface AuthResponse {
  token: string;
  refreshToken: string;
  user?: {
    workspaces?: Workspace[];
  };
}

// --- Config ---
const getApiBaseUrl = (): string => {
  const env = (import.meta as any).env;
  return env?.PUBLIC_API_BASE_URL || "http://localhost:3000/api";
};

const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.PUBLIC_GOOGLE_LOGIN_CLIENT_ID || "";
const FACEBOOK_APP_ID =
  (import.meta as any).env?.PUBLIC_FACEBOOK_LOGIN_APP_ID || "";

const API_BASE = getApiBaseUrl();

// --- Helpers ---
async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(options?.headers as Record<string, string>),
  };

  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${response.status}`);
  }

  return response.json();
}

// --- Login View ---

const LoginView: FC<{
  onLoginSuccess: (token: string) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  error?: string;
  setError: (v?: string) => void;
}> = ({ onLoginSuccess, isLoading, setIsLoading, error, setError }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(undefined);

    try {
      const data = await apiFetch<AuthResponse>("/auth/email/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      onLoginSuccess(data.token);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google login is not configured");
      return;
    }

    const redirectUri = window.location.origin + window.location.pathname;
    const scope = "email profile";
    const state = btoa(JSON.stringify({ type: "google_login" }));

    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth" +
      `?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      "&response_type=code" +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${encodeURIComponent(state)}` +
      "&prompt=select_account";

    const popup = window.open(
      authUrl,
      "google-login",
      "width=500,height=600,scrollbars=yes",
    );

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const { type, code, error: authError } = event.data || {};

      if (type !== "social_auth_callback") return;

      window.removeEventListener("message", handleMessage);
      popup?.close();

      if (authError) {
        setError(`Google login failed: ${authError}`);
        return;
      }

      if (!code) {
        setError("Google login failed: no code received");
        return;
      }

      setIsLoading(true);
      setError(undefined);

      try {
        const data = await apiFetch<AuthResponse>("/auth/google/login", {
          method: "POST",
          body: JSON.stringify({ code }),
        });

        onLoginSuccess(data.token);
      } catch (err: any) {
        setError(err.message || "Google login failed");
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener("message", handleMessage);
  };

  const handleFacebookLogin = () => {
    if (!FACEBOOK_APP_ID) {
      setError("Facebook login is not configured");
      return;
    }

    const redirectUri = window.location.origin + window.location.pathname;
    const scope = "email,public_profile";

    const authUrl =
      "https://www.facebook.com/v18.0/dialog/oauth" +
      `?client_id=${encodeURIComponent(FACEBOOK_APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      "&response_type=code" +
      `&scope=${encodeURIComponent(scope)}`;

    const popup = window.open(
      authUrl,
      "facebook-login",
      "width=500,height=600,scrollbars=yes",
    );

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const { type, code, accessToken, error: authError } = event.data || {};

      if (type !== "social_auth_callback") return;

      window.removeEventListener("message", handleMessage);
      popup?.close();

      if (authError) {
        setError(`Facebook login failed: ${authError}`);
        return;
      }

      setIsLoading(true);
      setError(undefined);

      try {
        const tokenToUse = accessToken || code;
        const data = await apiFetch<AuthResponse>("/auth/facebook/login", {
          method: "POST",
          body: JSON.stringify({ accessToken: tokenToUse }),
        });

        onLoginSuccess(data.token);
      } catch (err: any) {
        setError(err.message || "Facebook login failed");
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener("message", handleMessage);
  };

  return (
    <Box direction="vertical" gap="small" align="center" padding="large">
      <Card>
        <Card.Header
          title={
            <Text size="medium" weight="bold">
              Login to Rise AI
            </Text>
          }
          subtitle=" Sign in to connect your Wix store"
        />
        <Card.Divider />
        <Card.Content>
          <form onSubmit={handleSubmit}>
            <Box direction="vertical" gap="medium">
              <FormField label="Email Address">
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormField>
              <FormField label="Password">
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </FormField>
              {error && (
                <Box marginTop="small">
                  <Text skin="error" size="small">
                    {error}
                  </Text>
                </Box>
              )}
              <Box marginTop="medium">
                <Button type="submit" fullWidth loading={isLoading}>
                  Sign In
                </Button>
              </Box>
            </Box>
          </form>

          <Box
            marginTop="medium"
            marginBottom="medium"
            direction="horizontal"
            align="center"
            gap="small"
          >
            <Divider />
            <Text size="tiny" secondary weight="bold">
              OR
            </Text>
            <Divider />
          </Box>

          <Box direction="vertical" gap="small">
            <Button
              priority="secondary"
              fullWidth
              prefixIcon={<Icons.Google />}
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              Sign in with Google
            </Button>
            <Button
              priority="secondary"
              fullWidth
              prefixIcon={<Icons.FacebookSmall />}
              onClick={handleFacebookLogin}
              disabled={isLoading}
            >
              Sign in with Facebook
            </Button>
          </Box>

          <Box marginTop="medium" align="center">
            <Text size="small">
              Don&apos;t have an account?{" "}
              <a
                href="https://your-rise-ai-domain.com/auth/register"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: "bold", color: "#2d7ff9" }}
              >
                Sign Up
              </a>
            </Text>
          </Box>
        </Card.Content>
      </Card>
    </Box>
  );
};

// --- Workspace Selection View ---

const WorkspaceSelectionView: FC<{
  workspaces: Workspace[];
  onSelect: (workspace: Workspace) => void;
  isLoading: boolean;
  error?: string;
}> = ({ workspaces, onSelect, isLoading, error }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleConfirm = () => {
    const ws = workspaces.find((w) => w.id === selectedId);
    if (ws) onSelect(ws);
  };

  return (
    <Box direction="vertical" gap="small" align="center" padding="large">
      <Card>
        <Card.Header
          title={
            <Text size="medium" weight="bold">
              Select Workspace
            </Text>
          }
          subtitle=" Choose which workspace to connect to your Wix store"
        />
        <Card.Divider />
        <Card.Content>
          <Box direction="vertical" gap="medium">
            <Box
              direction="vertical"
              border="1px solid #dfe5eb"
              borderRadius="8px"
              maxHeight="300px"
              overflowY="auto"
            >
              {workspaces.length > 0 ? (
                workspaces.map((ws) => (
                  <ListItemSelect
                    key={ws.id}
                    title={ws.business_name}
                    selected={selectedId === ws.id}
                    onClick={() => setSelectedId(ws.id)}
                  />
                ))
              ) : (
                <Box padding="large" align="center">
                  <Text secondary>No workspaces found.</Text>
                </Box>
              )}
            </Box>

            {error && (
              <Text skin="error" size="small">
                {error}
              </Text>
            )}

            <Button
              fullWidth
              disabled={!selectedId || isLoading}
              loading={isLoading}
              onClick={handleConfirm}
            >
              Confirm and Connect
            </Button>
          </Box>
        </Card.Content>
      </Card>
    </Box>
  );
};

// --- Success View ---

const SuccessView: FC = () => {
  return (
    <Box
      direction="vertical"
      gap="large"
      align="center"
      padding="large"
      marginTop="64px"
    >
      <EmptyState
        skin="section"
        title="App Connected Successfully!"
        subtitle="Your Rise AI workspace is now linked with your Wix store. You can now start managing your AI agent."
        image={
          <Box color="green">
            <Icons.Check size="120px" />
          </Box>
        }
      />
      <Box marginTop="large">
        <Button onClick={() => window.location.reload()}>
          Back to Dashboard
        </Button>
      </Box>
    </Box>
  );
};

// --- Social Auth Callback Handler ---
// This page also serves as the OAuth redirect URI for social login popups.
// When a social login popup redirects back, we detect the code and send it
// to the opener window via postMessage.

const SocialAuthCallbackHandler: FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    // If we have OAuth params and we're in a popup, send to opener
    if ((code || error) && window.opener) {
      let parsedState: Record<string, unknown> = {};
      try {
        if (state) {
          parsedState = JSON.parse(atob(state));
        }
      } catch {
        // ignore
      }

      window.opener.postMessage(
        {
          type: "social_auth_callback",
          code,
          error,
          state: parsedState,
        },
        window.location.origin,
      );

      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return <>{children}</>;
};

// --- Main Page ---

const DashboardPage: FC = () => {
  const [step, setStep] = useState<"login" | "workspace-selection" | "success">(
    "login",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [token, setToken] = useState<string>();
  const [instanceId, setInstanceId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Wix passes the instance ID as a query parameter after app installation
    const instance = params.get("instance");
    setInstanceId(instance);
  }, []);

  const handleLoginSuccess = async (authToken: string) => {
    setToken(authToken);
    setIsLoading(true);
    setError(undefined);

    try {
      const userData = await apiFetch<any>("/auth/me", {
        token: authToken,
      });

      const userWorkspaces: Workspace[] =
        userData.workspaces?.map((w: any) => ({
          id: w.id,
          business_name: w.business_name || w.name || "Unnamed Workspace",
        })) || [];

      setWorkspaces(userWorkspaces);
      setStep("workspace-selection");
    } catch (err: any) {
      setError(err.message || "Failed to fetch workspaces");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkspaceSelect = async (workspace: Workspace) => {
    if (!instanceId) {
      setError(
        "No Wix instance ID found. Please reinstall the app from the Wix App Market.",
      );
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      await apiFetch<any>("/commerce/wix/install", {
        method: "POST",
        token,
        body: JSON.stringify({
          instance_id: instanceId,
          workspace_id: workspace.id,
        }),
      });

      setStep("success");
    } catch (err: any) {
      setError(err.message || "Failed to connect workspace");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SocialAuthCallbackHandler>
      <WixDesignSystemProvider features={{ newColorsBranding: true }}>
        <Page>
          <Page.Header
            title="Rise AI"
            subtitle="The multi-platform business communication hub"
          />
          <Page.Content>
            <Box direction="vertical" align="center" width="100%">
              <Box maxWidth="600px" width="100%">
                {step === "login" && (
                  <LoginView
                    onLoginSuccess={handleLoginSuccess}
                    isLoading={isLoading}
                    setIsLoading={setIsLoading}
                    error={error}
                    setError={setError}
                  />
                )}
                {step === "workspace-selection" && (
                  <WorkspaceSelectionView
                    workspaces={workspaces}
                    onSelect={handleWorkspaceSelect}
                    isLoading={isLoading}
                    error={error}
                  />
                )}
                {step === "success" && <SuccessView />}
              </Box>
            </Box>
          </Page.Content>
        </Page>
      </WixDesignSystemProvider>
    </SocialAuthCallbackHandler>
  );
};

export default DashboardPage;
