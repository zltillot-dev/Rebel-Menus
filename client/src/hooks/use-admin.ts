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
