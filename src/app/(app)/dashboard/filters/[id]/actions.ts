import { FieldFilterConfig } from "@/lib/types";

export async function getFieldFilterByIdAction(id: string): Promise<FieldFilterConfig | null> {
  const response = await fetch(`/api/filters/${id}`, {
    method: 'GET',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch field filter');
  }
  
  return response.json();
}

export async function updateFieldFilterAction(
  id: string, 
  data: Partial<FieldFilterConfig>
): Promise<FieldFilterConfig> {
  const response = await fetch(`/api/filters/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update field filter');
  }

  return response.json();
}
