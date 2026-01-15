import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertUser } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useChefs() {
  return useQuery({
    queryKey: [api.admin.listChefs.path],
    queryFn: async () => {
      const res = await fetch(api.admin.listChefs.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch chefs");
      return api.admin.listChefs.responses[200].parse(await res.json());
    },
  });
}

export function useCreateChef() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertUser) => {
      const res = await fetch(api.admin.createChef.path, {
        method: api.admin.createChef.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to create chef");
      return api.admin.createChef.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.listChefs.path] });
      toast({ title: "Success", description: "Chef profile created successfully" });
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

// Chef Tasks Management
export function useAllChefTasks() {
  return useQuery({
    queryKey: [api.admin.listChefTasks.path],
    queryFn: async () => {
      const res = await fetch(api.admin.listChefTasks.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch chef tasks");
      return res.json();
    },
  });
}

export function useCreateChefTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { chefId: number; title: string; description?: string; priority?: string; dueDate?: string }) => {
      const res = await fetch(api.admin.createChefTask.path, {
        method: api.admin.createChefTask.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.listChefTasks.path] });
      toast({ title: "Success", description: "Task created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateChefTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number; title?: string; description?: string; priority?: string; dueDate?: string; isCompleted?: boolean }) => {
      const res = await fetch(api.chefTasks.update.path.replace(':id', String(id)), {
        method: api.chefTasks.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.listChefTasks.path] });
      queryClient.invalidateQueries({ queryKey: [api.chefTasks.list.path] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteChefTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(api.admin.deleteChefTask.path.replace(':id', String(id)), {
        method: api.admin.deleteChefTask.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.listChefTasks.path] });
      toast({ title: "Success", description: "Task deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
