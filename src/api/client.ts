import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export const apiClient = (): AxiosInstance => {
  return axios.create({
    baseURL: process.env.API_BASE_URL || process.env.BASE_URL || '',
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });
};