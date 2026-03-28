export interface UserResponse {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TodoResponse {
  id: string;
  title: string;
  order: number | null;
  completed: boolean;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}
