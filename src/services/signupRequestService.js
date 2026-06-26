import { STORAGE_KEYS, safeReadStorage, writeStorage } from "../utils/storage.js";

export function readSignupRequests() {
  const savedRequests = safeReadStorage(STORAGE_KEYS.signupRequests, []);
  return Array.isArray(savedRequests) ? savedRequests : [];
}

export function writeSignupRequests(requests) {
  writeStorage(STORAGE_KEYS.signupRequests, Array.isArray(requests) ? requests : []);
}

export function appendSignupRequest(request) {
  const requestList = readSignupRequests();
  const nextRequests = [request, ...requestList];
  writeSignupRequests(nextRequests);
  return nextRequests;
}
