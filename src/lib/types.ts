export type TaskType =
  | "Assignment"
  | "Record"
  | "Reference Record"
  | "Form"
  | "Other";

export type ComplaintCategory =
  | "Infrastructure"
  | "Academic"
  | "Timetable"
  | "Other";

export type ComplaintStatus =
  | "Open"
  | "In Progress"
  | "Fixed"
  | "Cannot Be Fixed";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Admin {
  email: string;
  created_at: string;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
}

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  subject: string;
  description: string | null;
  due_at: string;
  link: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Complaint {
  id: string;
  student_id: string;
  title: string;
  category: ComplaintCategory;
  description: string;
  is_anonymous: boolean;
  status: ComplaintStatus;
  created_at: string;
  updated_at: string;
  replies?: ComplaintReply[];
}

export interface ComplaintReply {
  id: string;
  complaint_id: string;
  admin_id: string;
  admin_name: string;
  reply_text: string;
  created_at: string;
}

export interface AdminComplaintViewRow {
  id: string;
  title: string;
  category: ComplaintCategory;
  description: string;
  is_anonymous: boolean;
  status: ComplaintStatus;
  created_at: string;
  updated_at: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  replies?: ComplaintReply[];
}

export interface ResolvedComplaintViewRow {
  id: string;
  title: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  updated_at: string;
  latest_reply: string | null;
}
