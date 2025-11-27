import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "../config";

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("userToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      await SecureStore.deleteItemAsync("userToken");
    }
    return Promise.reject(err);
  }
);

export default api;
export const put = api.put;
export const del = api.delete;
