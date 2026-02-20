import axios from 'axios'
import { apiClient } from '../../shared/lib/axios'
import type {
  AuthResponse,
  ProfileResponse,
  ProfileUpdateRequest,
  SignupResponse,
} from '../../shared/lib/api.types'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await axios.post<AuthResponse>(`${baseURL}/auth/login`, { email, password })
  return response.data
}

export async function signup(
  email: string,
  password: string,
  display_name: string
): Promise<SignupResponse> {
  const response = await axios.post<SignupResponse>(`${baseURL}/auth/signup`, {
    email,
    password,
    display_name,
  })
  return response.data
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function refreshToken(refresh_token: string): Promise<AuthResponse> {
  const response = await axios.post<AuthResponse>(
    `${baseURL}/auth/refresh`,
    null,
    { params: { refresh_token } }
  )
  return response.data
}

export async function getProfile(): Promise<ProfileResponse> {
  const response = await apiClient.get<ProfileResponse>('/auth/me')
  return response.data
}

export async function updateProfile(data: ProfileUpdateRequest): Promise<ProfileResponse> {
  const response = await apiClient.patch<ProfileResponse>('/auth/me', data)
  return response.data
}
