import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Handle authentication errors
    if (res.status === 401) {
      // User not authenticated - redirect to FrameBox login
      const isDev = import.meta.env.DEV;
      const loginUrl = isDev 
        ? 'http://localhost:3000/login' 
        : 'https://framesbox.com/login';
      
      // Parse error message if available
      try {
        const errorData = JSON.parse(text);
        console.error('Authentication required:', errorData.message);
      } catch {
        console.error('Authentication required');
      }
      
      // Redirect to login page
      window.location.href = loginUrl;
      throw new Error('Authentication required');
    }
    
    // Handle authorization errors (user logged in but lacks permission)
    if (res.status === 403) {
      try {
        const errorData = JSON.parse(text);
        // Show user-friendly permission error
        throw new Error(errorData.message || "You don't have access to this feature");
      } catch (parseError) {
        throw new Error("You don't have permission to access this feature");
      }
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
