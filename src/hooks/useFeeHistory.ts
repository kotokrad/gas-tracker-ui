import { useCallback, useEffect, useRef, useState } from "react";
import { useInterval } from "react-use";
import { fetchFeeHistory } from "~/services/api";
import { ChartDuration, FeeHistoryRaw, FeeHistory } from "~/types";
import formatDateTime from "~/utils/formatDateTime";

const UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const RETRY_INTERVAL_MS = 3000; // 3 seconds

const expandData = (data: FeeHistoryRaw): FeeHistory =>
  data.min.map((_, index) => ({
    date: formatDateTime(data.start + data.tick * index),
    min: data.min[index],
    avg: data.avg[index],
  }));

type Cache = Record<ChartDuration, { updated: number; data: FeeHistory }>;

function useFeeHistory(duration: ChartDuration) {
  const [data, setData] = useState<FeeHistory>();
  const [error, setError] = useState<Error>();
  const [timestamp, setTimestamp] = useState(Date.now());

  const cache = useRef<Cache>({
    "1d": { updated: 0, data: [] },
    "1w": { updated: 0, data: [] },
    "1m": { updated: 0, data: [] },
  });

  const interval = error ? RETRY_INTERVAL_MS : UPDATE_INTERVAL_MS;

  const updateCache = useCallback(
    (data: FeeHistory) => {
      cache.current[duration].data = data;
      cache.current[duration].updated = Date.now();
      return data;
    },
    [cache, duration]
  );

  const clearError = () => setError(undefined);

  useInterval(() => setTimestamp(Date.now()), interval);

  useEffect(() => {
    if (
      !cache.current[duration].data.length ||
      Date.now() - cache.current[duration].updated > UPDATE_INTERVAL_MS
    ) {
      fetchFeeHistory(duration)
        .then(expandData)
        .then(updateCache)
        .then(setData)
        .then(clearError)
        .catch(setError);
    }
  }, [duration, timestamp, updateCache]);

  useEffect(() => {
    if (cache.current[duration].data.length) {
      setData(cache.current[duration].data);
    }
  }, [duration]);

  return { data, error };
}

export default useFeeHistory;