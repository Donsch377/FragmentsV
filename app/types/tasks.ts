export type TaskLinkType = string | null;

export type TaskRecord = {
  id: string;
  title: string;
  notes?: string | null;
  start_date?: string | null;
  start_at?: string | null;
  due_date?: string | null;
  due_at?: string | null;
  group_id?: string | null;
  completed: boolean;
  owner_id?: string | null;
  link_type: TaskLinkType;
  linked_food_id?: string | null;
  linked_recipe_id?: string | null;
  linked_text?: string | null;
  assignee_names?: string[] | null;
};
