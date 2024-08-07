import  User  from "./user.js";

export interface RegisterData {
    username: string;
    email: string;
    password: string;
    name: string;
  }
  
  export interface LoginCredentials {
    email: string;
    password: string;
  }
  
  export interface AuthResponse {
    accessToken: string;
    user: User;
  }