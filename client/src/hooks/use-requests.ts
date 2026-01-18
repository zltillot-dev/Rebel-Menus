import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertRequest, type InsertFeedback } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useRequests() {
  return useQuery({
    queryKey: [api.requests.list.path],
    queryFn: async () => {
      const res = await fetch(api.requests.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch requests");
      return api.requests.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertRequest) => {
      const res = await fetch(api.requests.create.path, {
        method: api.requests.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to create request");
      return api.requests.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.requests.list.path] });
      toast({ title: "Success", description: "Request submitted successfully" });
    },
  });
}

export function useFeedback() {
  return useQuery({
    queryKey: [api.feedback.list.path],
    queryFn: async () => {
      const res = await fetch(api.feedback.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch feedback");
      return api.feedback.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateFeedback() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertFeedback) => {
      const res = await fetch(api.feedback.create.path, {
        method: api.feedback.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to submit feedback");
      return api.feedback.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.feedback.list.path] });
      toast({ title: "Thank you!", description: "Your feedback has been recorded." });
    },
  });
}

export function useDeleteRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.requests.delete.path, { id });
      const res = await fetch(url, {
        method: api.requests.delete.method,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to delete request");
      return api.requests.delete.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.requests.list.path] });
      toast({ title: "Success", description: "Request deleted successfully" });
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

// Late plates for chef dashboard
export function useLatePlates() {
  return useQuery({
    queryKey: ["/api/late-plates"],
    queryFn: async () => {
      const res = await fetch("/api/late-plates", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch late plates");
      return res.json();
    },
  });
}

// Substitutions and menu suggestions for chef dashboard
export function useChefRequests() {
  return useQuery({
    queryKey: ["/api/chef-requests"],
    queryFn: async () => {
      const res = await fetch("/api/chef-requests", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch chef requests");
      return res.json();
    },
  });
}

// Feedback for chef dashboard
export function useChefFeedback() {
  return useQuery({
    queryKey: ["/api/chef-feedback"],
    queryFn: async () => {
      const res = await fetch("/api/chef-feedback", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch chef feedback");
      return res.json();
    },
  });
}

// Tasks for chef dashboard
export function useChefTasks() {
  return useQuery({
    queryKey: [api.chefTasks.list.path],
    queryFn: async () => {
      const res = await fetch(api.chefTasks.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch chef tasks");
      return res.json();
    },
  });
}

export function useUpdateChefTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      const res = await fetch(api.chefTasks.update.path.replace(':id', String(id)), {
        method: api.chefTasks.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.chefTasks.list.path] });
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

// Mark request (substitution/menu suggestion) as read
export function useMarkRequestRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isRead }: { id: number; isRead: boolean }) => {
      const res = await fetch(api.requests.markRead.path.replace(':id', String(id)), {
        method: api.requests.markRead.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chef-requests"] });
    },
  });
}

// Mark feedback as read
export function useMarkFeedbackRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isRead }: { id: number; isRead: boolean }) => {
      const res = await fetch(api.chefFeedback.markRead.path.replace(':id', String(id)), {
        method: api.chefFeedback.markRead.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update feedback");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chef-feedback"] });
    },
  });
}

// Update request status (approve/reject substitution)
export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'approved' | 'rejected' | 'pending' }) => {
      const res = await fetch(api.requests.updateStatus.path.replace(':id', String(id)), {
        method: api.requests.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update request status");
      }
      return res.json();
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chef-requests"] });
      queryClient.invalidateQueries({ queryKey: [api.requests.list.path] });
      toast({ 
        title: status === 'approved' ? "Approved" : "Rejected", 
        description: `Substitution request has been ${status}` 
      });
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
