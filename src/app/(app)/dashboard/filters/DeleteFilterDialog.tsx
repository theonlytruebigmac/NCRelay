"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { deleteFieldFilterAction } from "./actions";

export function DeleteFilterDialog({ 
  filterId, 
  filterName 
}: { 
  filterId: string; 
  filterName: string 
}) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteFieldFilterAction(filterId);
      toast({
        title: "Filter deleted",
        description: `&quot;${filterName}&quot; has been deleted successfully.`
      });
      setOpen(false);
      router.push("/dashboard/filters");
      router.refresh();
    } catch (error) {
      toast({
        title: "Error deleting filter",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Field Filter</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the field filter &quot;{filterName}&quot;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Filter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
