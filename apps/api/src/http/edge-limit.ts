export type EdgeLimiter = {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
};

export const underEdgeLimit = async (limiter: EdgeLimiter | undefined, key: string): Promise<boolean> => {
  if (limiter === undefined) return true;
  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch {
    return true;
  }
};
