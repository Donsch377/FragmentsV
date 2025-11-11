export const repoError = (action: string, error: unknown) => {
  console.error(`[repo:${action}]`, error);
  return new Error(`Unable to ${action}`);
};
