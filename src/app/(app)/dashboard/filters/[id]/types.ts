import { FieldFilterConfig } from "@/lib/types";

export type FilterPageParams = {
  params: Promise<{ id: string }>;
};

export interface FilterDetailsPageProps {
  params: Promise<{ id: string }>;
}

export type ResolvedFilterDetailsPageProps = {
  filter: FieldFilterConfig;
  id: string;
};
