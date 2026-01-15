import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertMenu, type InsertMenuItem, type Menu, type MenuItem } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

type MenuWithItems = Menu & { items: MenuItem[] };

// Helper schema for creating a menu with items
export type CreateMenuInput = InsertMenu & { items: Omit<InsertMenuItem, "menuId">[] };

export function useMenus(filters?: { fraternity?: string; status?: string }) {
  // Construct query string manually if needed or pass as search params
  const queryString = filters 
    ? "?" + new URLSearchParams(filters as Record<string, string>).toString() 
    : "";

  return useQuery({
    queryKey: [api.menus.list.path, filters],
    queryFn: async () => {
      const res = await fetch(api.menus.list.path + queryString, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch menus");
      return api.menus.list.responses[200].parse(await res.json());
    },
  });
}

export function useMenu(id: number) {
  return useQuery({
    queryKey: [api.menus.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.menus.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch menu");
      return api.menus.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateMenu() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateMenuInput) => {
      const res = await fetch(api.menus.create.path, {
        method: api.menus.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to create menu");
      return api.menus.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.menus.list.path] });
      toast({ title: "Success", description: "Menu created successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

export function useUpdateMenuStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: number; status: string; adminNotes?: string }) => {
      const url = buildUrl(api.menus.updateStatus.path, { id });
      const res = await fetch(url, {
        method: api.menus.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update menu status");
      return api.menus.updateStatus.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.menus.list.path] });
      const message = variables.status === 'needs_revision' 
        ? "Menu sent back for revision" 
        : "Menu status updated";
      toast({ title: "Success", description: message });
    },
  });
}
