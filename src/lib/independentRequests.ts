export type IndependentRequest<T> = {
  run: () => Promise<T>;
  onSuccess: (value: T) => void;
  onError: (error: unknown) => void;
  onSettled: () => void;
};

export const runIndependentRequests = async <T>(
  requests: IndependentRequest<T>[],
): Promise<void> => {
  await Promise.allSettled(
    requests.map(async ({ run, onSuccess, onError, onSettled }) => {
      try {
        onSuccess(await run());
      } catch (error) {
        onError(error);
      } finally {
        onSettled();
      }
    }),
  );
};
