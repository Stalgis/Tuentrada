import { mockEvents, type Event } from '../data/mockEvents';

const MOCK_DELAY = 750;

const wait = <T,>(data: T, shouldReject = false) =>
  new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      if (shouldReject) {
        reject(new Error('Network unavailable'));
      } else {
        resolve(data);
      }
    }, MOCK_DELAY);
  });

export const fetchEvents = async (): Promise<Event[]> => {
  const simulateError = false;
  return wait(mockEvents, simulateError);
};

export const fetchEventById = async (id: string): Promise<Event | undefined> => {
  const event = mockEvents.find((item) => item.id === id);
  return wait(event);
};

export type ApiClient = {
  fetchEvents: typeof fetchEvents;
  fetchEventById: typeof fetchEventById;
};

export const apiClient: ApiClient = {
  fetchEvents,
  fetchEventById,
};

// TODO: Replace with apiClient.ts that wraps Axios, reads base URLs from .env,
// and handles authentication headers and retries.
